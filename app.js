require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

// --- Import Routes ---
const adminRoutes = require('./routes/adminRoutes');
const clientRoutes = require('./routes/clientRoutes');

// --- Import Controllers ---
const roomController = require('./controllers/roomController');
const authController = require('./controllers/authController');
const bookingController = require('./controllers/bookingController');

const app = express();

// --- View Engine Setup ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Layout Configuration ---
app.use(expressLayouts);
app.set('layout', false);

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- Session Configuration ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'dangs_resort_secret_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// --- Middleware: Admin Protection ---
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role.toLowerCase() === 'admin') return next();
    res.redirect('/login');
};

// --- Middleware: Client Protection ---
const isClient = (req, res, next) => {
    if (req.session.user && req.session.user.role.toLowerCase() === 'customer') return next();
    res.redirect('/login');
};

// --- Global Variables for Views ---
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.path = req.path;
    next();
});

// --- Routes ---

// Home & Auth
app.get('/', roomController.getHomePage);
app.get('/login', authController.getLogin);
app.post('/login', authController.postLogin);
app.get('/register', authController.getRegister);
app.post('/register', authController.postRegister);
app.get('/logout', authController.logout);

// --- Admin Routes ---
app.use('/admin', isAdmin, adminRoutes);  // Admin dashboard & all admin routes

// --- Client Routes ---
app.use('/client', isClient, clientRoutes); // client dashboard & booking history
app.get('/dashboard', isClient, clientRoutes); // optional alias for convenience

// --- Booking Pages (Protected) ---
app.get('/book/:id', isClient, bookingController.getBookingPage);
app.post('/book/confirm/:id', isClient, bookingController.confirmBooking);

// --- Error Handling ---
app.use((err, req, res, next) => {
    console.error("🔥 Server Error:", err.stack);
    res.status(500).send('Something broke! Check the console.');
});

// --- 404 Handler ---
app.use((req, res) => {
    res.status(404).send('404 Not Found — The page you requested does not exist.');
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Sanctuary Server: http://localhost:${PORT}`);
});