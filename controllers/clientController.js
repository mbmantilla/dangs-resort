const db = require('../config/db');

const clientController = {

    // --- Client Dashboard ---
    getDashboard: (req, res) => {
        if (!req.session.user) return res.redirect('/login');

        const userId = req.session.user.id;

        const roomsSql = `
            SELECT id, name, type, price, status, image_url
            FROM rooms
            ORDER BY id DESC
        `;

        const bookingsSql = `
            SELECT 
                b.id AS booking_id,
                b.user_id,
                b.room_id,
                b.booking_date,
                b.check_in,
                b.check_out,
                b.status,
                b.guest_name,
                b.phone,
                b.ref_code,
                b.requests,
                COALESCE(r.name, 'Unknown Residence') AS room_name,
                COALESCE(r.type, 'Unknown Type') AS room_type,
                COALESCE(r.price, 0) AS room_price,
                COALESCE(r.image_url, '') AS room_image,
                COALESCE(DATEDIFF(b.check_out, b.check_in) * r.price, r.price) AS total_price
            FROM bookings b
            LEFT JOIN rooms r ON b.room_id = r.id
            WHERE b.user_id = ?
            ORDER BY b.booking_date DESC
        `;

        db.query(roomsSql, (roomsErr, rooms) => {
            if (roomsErr) {
                console.error('❌ Rooms Fetch Error:', roomsErr);
                return res.status(500).send('Error loading rooms.');
            }

            db.query(bookingsSql, [userId], (bookingsErr, bookings) => {
                if (bookingsErr) {
                    console.error('❌ Client Bookings Fetch Error:', bookingsErr);
                    return res.status(500).send('Error loading your reservations.');
                }

                bookings.forEach(b => {
                    if (!b.status) b.status = 'Pending';
                    if (!b.room_name) b.room_name = 'Unknown Residence';
                    if (!b.room_type) b.room_type = 'Unknown Type';
                    if (!b.guest_name) b.guest_name = req.session.user.username || 'Guest';
                    if (!b.phone) b.phone = 'N/A';
                    if (!b.ref_code) b.ref_code = 'TBD';
                    if (!b.requests) b.requests = 'None';
                });

                res.render('client_dashboard', {
                    user: req.session.user,
                    rooms: rooms || [],
                    bookings: bookings || []
                });
            });
        });
    },

    // --- Confirm Booking ---
    confirmBooking: (req, res) => {
        if (!req.session.user) return res.redirect('/login');

        const userId = req.session.user.id;
        const roomId = req.params.id;
        const { guest_name, phone, check_in, check_out, ref_code, requests } = req.body;

        if (!check_in || !check_out) {
            return res.status(400).send('Check-in and Check-out dates are required.');
        }

        const roomPriceSql = `SELECT price FROM rooms WHERE id = ?`;
        db.query(roomPriceSql, [roomId], (err, result) => {
            if (err || !result.length) {
                console.error('❌ Fetch Room Price Error:', err);
                return res.status(500).send('Error fetching room price.');
            }

            const roomPrice = result[0].price;
            const nights = Math.ceil((new Date(check_out) - new Date(check_in)) / (1000*60*60*24)) || 1;
            const total_price = roomPrice * nights;

            const sql = `
                INSERT INTO bookings
                (user_id, room_id, guest_name, phone, booking_date, check_in, check_out, ref_code, requests, status, total_price)
                VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, 'Pending', ?)
            `;

            db.query(sql, [
                userId,
                roomId,
                guest_name || req.session.user.username,
                phone,
                check_in,
                check_out,
                ref_code || 'TBD',
                requests || 'None',
                total_price
            ], (insertErr) => {
                if (insertErr) {
                    console.error('❌ Booking Creation Error:', insertErr);
                    return res.status(500).send('Error finalizing booking.');
                }

                console.log(`✅ Booking Success: Room ${roomId}, Ref: ${ref_code}, Total: ${total_price}`);
                res.redirect('/dashboard');
            });
        });
    },

    // --- Cancel Booking ---
    cancelBooking: (req, res) => {
        if (!req.session.user) return res.redirect('/login');

        const bookingId = req.params.id;
        const userId = req.session.user.id;

        const sql = `
            UPDATE bookings
            SET status = 'Cancelled'
            WHERE id = ? AND user_id = ? AND LOWER(status) = 'pending'
        `;

        db.query(sql, [bookingId, userId], (err, result) => {
            if (err) {
                console.error('❌ Cancel Booking Error:', err);
                return res.status(500).send('Error cancelling booking.');
            }

            if (result.affectedRows === 0) {
                return res.status(400).send('Cannot cancel this booking.');
            }

            res.redirect('/dashboard');
        });
    }

};

module.exports = clientController;