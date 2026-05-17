const express = require('express');
const router = express.Router();

const clientController = require('../controllers/clientController');

// Client Dashboard
router.get('/dashboard', clientController.getDashboard);

// Cancel booking through form button
router.post('/booking/:id/cancel', clientController.cancelBooking);

// Optional fallback:
// If someone manually opens /client/booking/:id/cancel in the browser,
// redirect them back instead of showing 404.
// Browser address bar uses GET, not POST.
router.get('/booking/:id/cancel', (req, res) => {
    res.redirect('/dashboard');
});

module.exports = router;