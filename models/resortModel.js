const db = require('../config/db');

const Resort = {
    // 1. Fetch available rooms (Fixed SQL syntax)
    getAvailableRooms: (callback) => {
        // We use single quotes for 'available' to treat it as a string value
        const sql = "SELECT * FROM rooms WHERE status = 'available'";
        db.query(sql, (err, results) => {
            callback(err, results);
        });
    },

    // 2. Create a booking record
    createBooking: (userId, roomId, callback) => {
        const sql = "INSERT INTO bookings (user_id, room_id, status) VALUES (?, ?, 'pending')";
        db.query(sql, [userId, roomId], (err, result) => {
            callback(err, result);
        });
    },

    // 3. Update room status after booking
    updateRoomStatus: (roomId, status, callback) => {
        const sql = "UPDATE rooms SET status = ? WHERE id = ?";
        db.query(sql, [status, roomId], (err, result) => {
            callback(err, result);
        });
    },

    // 4. View booking status for a specific customer
    getCustomerBookings: (userId, callback) => {
        const sql = `
            SELECT bookings.id, rooms.name, rooms.type, bookings.booking_date, bookings.status 
            FROM bookings 
            JOIN rooms ON bookings.room_id = rooms.id 
            WHERE bookings.user_id = ?`;
        db.query(sql, [userId], (err, results) => {
            callback(err, results);
        });
    }
};

module.exports = Resort;