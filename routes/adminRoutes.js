const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const adminController = require('../controllers/adminController');
const { Parser } = require('json2csv'); // npm install json2csv

// --- Ensure upload folder exists ---
const uploadPath = 'public/uploads/';
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// --- Multer Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadPath),
    filename: (req, file, cb) => {
        const cleanName = file.originalname.replace(/\s+/g, '-');
        cb(null, Date.now() + '-' + cleanName);
    }
});
const upload = multer({ storage });

// --- Safety wrapper for controller functions ---
const useController = (functionName) => {
    if (typeof adminController[functionName] !== 'function') {
        return (req, res) => {
            console.error(`❌ Missing controller function: adminController.${functionName}`);
            return res.status(500).send(`Server error: adminController.${functionName} is missing.`);
        };
    }
    return adminController[functionName];
};

// --- Dashboard & Reports ---
router.get('/dashboard', useController('getDashboard'));
router.get('/reports', useController('getReports'));

// --- Facilities Management ---
router.get('/facilities', useController('getFacilities'));
router.post('/facilities/add', upload.single('image'), useController('addFacility'));
router.post('/facilities/update/:id', upload.single('image'), useController('updateFacility'));
router.get('/facilities/delete/:id', useController('deleteFacility'));

// --- Booking Management ---
router.get('/bookings', useController('getBookings'));

// Singular route matches fetch in bookings.ejs
router.get('/booking/details/:id', useController('getBookingDetails'));

// Optional: keep old plural route for legacy compatibility
router.get('/bookings/details/:id', useController('getBookingDetails'));

router.post('/booking/status/:id', useController('updateBookingStatus'));

// --- Client Management ---
router.get('/clients', useController('getClients'));
router.get('/clients/:id/history', useController('getClientHistory'));

// --- Settings ---
router.get('/settings', useController('getSettings'));
router.post('/settings/update', useController('updateSettings'));

// --- Export Reports ---
router.get('/reports/export', useController('exportReports'));

module.exports = router;