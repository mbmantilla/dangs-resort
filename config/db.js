require('dotenv').config();
const mysql = require('mysql2');

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    // THE FIX: Explicitly handle the SSL handshake
    ssl: {
        rejectUnauthorized: false // Helps bypass local CA certificate issues
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000 // Increased timeout for slower connections
};

const pool = mysql.createPool(dbConfig);

// Test the connection immediately on startup
pool.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Database Connection Failed!");
        console.error("Error Detail:", err.message);
    } else {
        console.log("✅ Successfully connected to Aiven MySQL!");
        connection.release();
    }
});

module.exports = pool;