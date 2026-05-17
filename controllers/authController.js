const db = require('../config/db');
const bcrypt = require('bcryptjs');

const authController = {
    // Render Login Page
    getLogin: (req, res) => {
        res.render('login', { user: req.session.user || null, error: null });
    },

    // Render Register Page
    getRegister: (req, res) => {
        res.render('register', { user: req.session.user || null, error: null });
    },

    // UPDATED: Multi-Role Dashboard Logic
    getDashboard: (req, res) => {
        if (!req.session.user) {
            console.log("⚠️ Unauthorized access attempt to /dashboard");
            return res.redirect('/login');
        }

        // If the user is an admin, redirect them to the Admin Panel
        if (req.session.user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        }

        const userId = req.session.user.id;

        // Query 1: Fetch Available Rooms
        const roomsSql = "SELECT * FROM rooms";
        
        // Query 2: Fetch User's personal bookings
        const bookingsSql = `
            SELECT bookings.id, rooms.name, rooms.type, bookings.booking_date, bookings.status 
            FROM bookings 
            JOIN rooms ON bookings.room_id = rooms.id 
            WHERE bookings.user_id = ?
            ORDER BY bookings.booking_date DESC`;

        db.query(roomsSql, (err, roomResults) => {
            if (err) {
                console.error("❌ Error fetching rooms:", err);
                return res.redirect('/');
            }

            db.query(bookingsSql, [userId], (err, bookingResults) => {
                if (err) {
                    console.error("❌ Dashboard SQL Error:", err);
                    return res.redirect('/');
                }
                
                console.log(`📊 Loading professional sanctuary for: ${req.session.user.username}`);
                res.render('client_dashboard', { 
                    user: req.session.user, 
                    rooms: roomResults,      
                    bookings: bookingResults 
                });
            });
        });
    },

    // Handle Registration
    postRegister: async (req, res) => {
        const { username, email, password } = req.body;

        try {
            db.query('SELECT email FROM users WHERE email = ?', [email], async (err, results) => {
                if (err) {
                    console.error("❌ DB Check Error:", err.sqlMessage);
                    return res.render('register', { error: 'Database connection issue.', user: null });
                }

                if (results.length > 0) {
                    return res.render('register', { error: 'Email already registered', user: null });
                }

                const hashedPassword = await bcrypt.hash(password, 10);
                
                // Defaults to 'customer' as seen in your DB schema
                const sql = "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'customer')";
                
                db.query(sql, [username, email, hashedPassword], (err, result) => {
                    if (err) {
                        console.error("❌ Insert Error:", err.sqlMessage);
                        return res.render('register', { error: 'Registration failed: ' + err.sqlMessage, user: null });
                    }
                    console.log("✅ New guest registered:", email);
                    res.redirect('/login');
                });
            });
        } catch (error) {
            console.error("❌ Hashing Error:", error);
            res.render('register', { error: 'An unexpected error occurred.', user: null });
        }
    },

    // Handle Login with Admin Redirect
    postLogin: (req, res) => {
        const { email, password } = req.body;

        const sql = 'SELECT * FROM users WHERE email = ?';
        db.query(sql, [email], async (err, results) => {
            if (err) {
                console.error("❌ Login Query Error:", err);
                return res.render('login', { error: 'Server error during login.', user: null });
            }

            if (results.length === 0) {
                return res.render('login', { error: 'Account not found', user: null });
            }

            const user = results[0];
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                // Save the role in the session
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    role: user.role
                };
                
                console.log(`🔑 ${user.role.toUpperCase()} session created: ${user.username}`);

                // Route based on role
                if (user.role === 'admin') {
                    return res.redirect('/admin/dashboard');
                } else {
                    return res.redirect('/dashboard');
                }
            } else {
                res.render('login', { error: 'Incorrect password', user: null });
            }
        });
    },

    // Handle Logout
    logout: (req, res) => {
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.redirect('/');
        });
    }
};

module.exports = authController;