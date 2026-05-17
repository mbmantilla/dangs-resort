const Resort = require('../models/resortModel');

exports.getHomePage = (req, res) => {
    Resort.getAvailableRooms((err, results) => {
        if (err) return res.status(500).send(err);
        res.render('index', { rooms: results, user: req.session.user });
    });
};

exports.bookRoom = (req, res) => {
    const roomId = req.params.id;
    const userId = req.session.user.id;

    Resort.createBooking(userId, roomId, (err) => {
        if (err) return res.status(500).send("Booking failed.");
        
        // After booking, mark room as booked
        Resort.updateRoomStatus(roomId, 'booked', () => {
            res.redirect('/my-bookings');
        });
    });
};