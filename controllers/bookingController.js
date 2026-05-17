const db = require('../config/db');

const bookingController = {
    // Step 1: Render the Booking Form with QR Code
    getBookingPage: (req, res) => {
        // Security check: Ensure guest is logged in
        if (!req.session.user) return res.redirect('/login');

        const roomId = req.params.id;
        const sql = "SELECT * FROM rooms WHERE id = ?";

        db.query(sql, [roomId], (err, results) => {
            if (err || results.length === 0) {
                console.error("❌ Room fetch error or room not found:", err);
                return res.redirect('/dashboard');
            }
            // Pass both room data and user session to the booking page
            res.render('booking', { 
                room: results[0], 
                user: req.session.user 
            });
        });
    },

    // Step 2: Handle Final Submission (Details + Payment Ref)
    confirmBooking: (req, res) => {
        if (!req.session.user) return res.redirect('/login');

        const { guest_name, phone, check_in, check_out, total_price, ref_code, requests } = req.body;
        const roomId = req.params.id;
        const userId = req.session.user.id;

        // Fallbacks
        const finalGuestName = guest_name || req.session.user.username;
        const finalRequests = requests || 'None';
        const finalTotalPrice = total_price ? Number(total_price) : 0;
        const now = new Date(); // booking_date = current date/time

        // Insert into bookings table (ensure columns exist in your DB)
        const sql = `
            INSERT INTO bookings
            (user_id, room_id, booking_date, status, guest_name, phone, check_in, check_out, total_price, ref_code, requests)
            VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [userId, roomId, now, finalGuestName, phone, check_in, check_out, finalTotalPrice, ref_code, finalRequests],
            (err, result) => {
                if (err) {
                    console.error("❌ SQL Insertion Error:", err.message);
                    return res.status(500).send(`Reservation Error: ${err.message}`);
                }

                console.log(`✅ Success: Room ${roomId} reserved by ${finalGuestName}. Ref: ${ref_code}`);
                res.redirect('/dashboard');
            }
        );
    }
};

module.exports = bookingController;