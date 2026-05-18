const db = require('../config/db');
const { Parser } = require('json2csv');

const adminController = {

    // --- Dashboard Stats ---
    getDashboard: (req, res) => {
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM bookings) AS totalBookings,
                (SELECT COUNT(*) FROM bookings WHERE LOWER(status)='pending') AS pendingPayments,
                (SELECT COUNT(*) FROM users WHERE role='customer') AS registeredGuests,
                (SELECT COUNT(*) FROM rooms) AS activeFacilities,
                (SELECT SUM(rooms.price) 
                 FROM bookings 
                 JOIN rooms ON bookings.room_id = rooms.id 
                 WHERE LOWER(bookings.status)='approved') AS totalRevenue,
                (SELECT COUNT(*) FROM bookings WHERE DATE(booking_date)=CURDATE()) AS todayArrivals
        `;

        const statusChartQuery = `
            SELECT LOWER(status) AS status, COUNT(*) AS count
            FROM bookings
            GROUP BY LOWER(status)
        `;

        const revenueTrendQuery = `
            SELECT DATE_FORMAT(booking_date,'%b %Y') AS month, 
                   SUM(rooms.price) AS monthly_total,
                   COUNT(b.id) AS total_bookings
            FROM bookings b
            JOIN rooms ON b.room_id = rooms.id
            WHERE LOWER(b.status)='approved'
            GROUP BY month
            ORDER BY MIN(booking_date) ASC
            LIMIT 6
        `;

        db.query(statsQuery, (err, statsResults) => {
            if (err) console.error("Dashboard stats error:", err);

            db.query(statusChartQuery, (err, chartResults) => {
                if (err) console.error("Status chart error:", err);

                db.query(revenueTrendQuery, (err, revenueTrendResults) => {
                    if (err) console.error("Revenue trend error:", err);

                    const stats = {
                        totalBookings: statsResults?.[0]?.totalBookings || 0,
                        todayArrivals: statsResults?.[0]?.todayArrivals || 0,
                        pendingPayments: statsResults?.[0]?.pendingPayments || 0,
                        revenue: statsResults?.[0]?.totalRevenue || 0,
                        registeredGuests: statsResults?.[0]?.registeredGuests || 0,
                        activeFacilities: statsResults?.[0]?.activeFacilities || 0,
                        chartData: chartResults || [],
                        revenueTrend: revenueTrendResults || []
                    };

                    res.render('admin/dashboard', { stats, layout: 'admin/layout' });
                });
            });
        });
    },

    // --- Reports ---
    getReports: (req, res) => {
        const revenueSql = `
            SELECT 
                DATE_FORMAT(booking_date, '%b %Y') AS month, 
                SUM(rooms.price) AS monthly_total,
                COUNT(b.id) AS total_bookings
            FROM bookings b
            JOIN rooms ON b.room_id = rooms.id
            WHERE LOWER(TRIM(b.status)) = 'approved'
            GROUP BY month
            ORDER BY MIN(booking_date) ASC
            LIMIT 6
        `;

        const popularitySql = `
            SELECT 
                rooms.name, 
                COUNT(bookings.id) AS total_bookings
            FROM bookings
            JOIN rooms ON bookings.room_id = rooms.id
            GROUP BY rooms.name
            ORDER BY total_bookings DESC
        `;

        const statusSql = `
            SELECT 
                LOWER(TRIM(COALESCE(NULLIF(status, ''), 'pending'))) AS status,
                COUNT(*) AS count
            FROM bookings
            GROUP BY LOWER(TRIM(COALESCE(NULLIF(status, ''), 'pending')))
        `;

        db.query(revenueSql, (err, revenueData) => {
            if (err) {
                console.error("Revenue Query Error:", err);
                revenueData = [];
            }

            db.query(popularitySql, (err, popularityData) => {
                if (err) {
                    console.error("Popularity Query Error:", err);
                    popularityData = [];
                }

                db.query(statusSql, (err, chartData) => {
                    if (err) {
                        console.error("Booking Status Query Error:", err);
                        chartData = [];
                    }

                    console.log("Reports Booking Status Data:", chartData);

                    res.render('admin/reports', {
                        revenueData: revenueData || [],
                        popularityData: popularityData || [],
                        chartData: chartData || [],
                        layout: 'admin/layout'
                    });
                });
            });
        });
    },

    // --- Facilities ---
    getFacilities: (req, res) => {
        db.query("SELECT * FROM rooms ORDER BY id DESC", (err, rooms) => {
            if(err) return res.redirect('/admin/dashboard');
            res.render('admin/facilities', { rooms, path:req.path, layout:'admin/layout' });
        });
    },
    addFacility: (req, res) => {
        const { name, type, price, status } = req.body;
        const image_url = req.file ? `/uploads/${req.file.filename}` : '/images/default-room.jpg';
        db.query("INSERT INTO rooms (name,type,price,status,image_url) VALUES (?,?,?,?,?)",
            [name,type,price,status,image_url],
            (err)=>{
                if(err) return res.status(500).send("Error adding facility");
                res.redirect('/admin/facilities?success=added');
            }
        );
    },
    updateFacility: (req, res) => {
        const { id } = req.params;
        const { name,type,price,status } = req.body;
        let sql, params;
        if(req.file){
            const image_url = `/uploads/${req.file.filename}`;
            sql = "UPDATE rooms SET name=?, type=?, price=?, status=?, image_url=? WHERE id=?";
            params = [name,type,price,status,image_url,id];
        } else {
            sql = "UPDATE rooms SET name=?, type=?, price=?, status=? WHERE id=?";
            params = [name,type,price,status,id];
        }
        db.query(sql, params, (err)=>{ if(err) return res.status(500).send("Error updating facility"); res.redirect('/admin/facilities?success=updated'); });
    },
    deleteFacility: (req, res) => {
        const { id } = req.params;
        db.query("DELETE FROM rooms WHERE id=?", [id], (err)=>{ if(err) return res.status(500).send("Error deleting facility"); res.redirect('/admin/facilities?success=deleted'); });
    },

    // --- Bookings ---
    getBookings: (req,res)=>{
        const sql=`SELECT b.id AS booking_id, b.booking_date, b.ref_code, b.status, b.guest_name, b.phone,
                   b.check_in, b.check_out, b.total_price, b.requests,
                   r.name AS room_name, r.type AS room_type, u.username AS account_holder
                   FROM bookings b
                   LEFT JOIN rooms r ON b.room_id=r.id
                   LEFT JOIN users u ON b.user_id=u.id
                   ORDER BY b.booking_date DESC`;
        db.query(sql,(err,results)=>{
            if(err) return res.redirect('/admin/dashboard');
            const bookings = results.map(b=>({
                ...b,
                guest_name:b.guest_name||b.account_holder||'Walk-in Guest',
                phone:b.phone||'No Phone',
                ref_code:b.ref_code||'---',
                booking_date:b.booking_date?new Date(b.booking_date):null,
                check_in:b.check_in?new Date(b.check_in):null,
                check_out:b.check_out?new Date(b.check_out):null,
                total_price:b.total_price||0,
                requests:b.requests||'None',
                room_name:b.room_name||'Unknown',
                room_type:b.room_type||'Unknown'
            }));
            res.render('admin/bookings',{ bookings, layout:'admin/layout' });
        });
    },

    getBookingDetails:(req,res)=>{
        const { id } = req.params;
        const sql=`SELECT b.id AS booking_id, b.booking_date, b.ref_code, b.status, b.guest_name, b.phone,
                   b.check_in, b.check_out, b.total_price, b.requests,
                   r.name AS room_name, r.type AS room_type, u.username AS account_holder
                   FROM bookings b
                   LEFT JOIN rooms r ON b.room_id = r.id
                   LEFT JOIN users u ON b.user_id = u.id
                   WHERE b.id=?`;
        db.query(sql,[id],(err,results)=>{
            if(err) return res.status(500).json({error:'Database error'});
            if(!results||results.length===0) return res.status(404).json({error:'Booking not found'});
            const b=results[0];
            res.json({
                booking_id:b.booking_id,
                booking_date:b.booking_date||null,
                ref_code:b.ref_code||'---',
                status:b.status||'PENDING',
                guest_name:b.guest_name||b.account_holder||'Walk-in Guest',
                phone:b.phone||'No Phone',
                check_in:b.check_in||null,
                check_out:b.check_out||null,
                total_price:b.total_price||0,
                requests:b.requests||'None',
                room_name:b.room_name||'Unknown',
                room_type:b.room_type||'Unknown',
                account_holder:b.account_holder
            });
        });
    },

    updateBookingStatus:(req,res)=>{
        const {id}=req.params; const {status}=req.body;
        db.query("UPDATE bookings SET status=? WHERE id=?",[status,id],(err)=>{
            if(err) return res.status(500).json({success:false,error:'Database error'});
            res.json({success:true,message:`Reservation has been ${status}`});
        });
    },

    // --- Clients ---
    getClients:(req,res)=>{
        db.query("SELECT id, username, email, role FROM users WHERE role='customer' ORDER BY id DESC",(err,clients)=>{
            if(err) return res.redirect('/admin/dashboard');
            res.render('admin/clients',{ clients, layout:'admin/layout' });
        });
    },

    getClientHistory: (req,res)=>{
        const clientId=req.params.id;
        const sql=`SELECT b.id AS booking_id, b.booking_date, b.ref_code, b.status,
                   r.name AS room_name, r.type AS room_type,
                   b.check_in, b.check_out, b.total_price, b.requests
                   FROM bookings b
                   LEFT JOIN rooms r ON b.room_id = r.id
                   WHERE b.user_id=?
                   ORDER BY b.booking_date DESC`;
        db.query(sql,[clientId],(err,results)=>{
            if(err){ console.error("Client history fetch error:", err); return res.redirect('/admin/clients'); }
            const bookings = results.map(b => ({
                ...b,
                booking_date: b.booking_date ? new Date(b.booking_date) : null,
                check_in: b.check_in ? new Date(b.check_in) : null,
                check_out: b.check_out ? new Date(b.check_out) : null,
                total_price: b.total_price || 0,
                requests: b.requests || 'None',
                room_name: b.room_name || 'Unknown',
                room_type: b.room_type || 'Unknown'
            }));
            res.render('admin/clientHistory',{ bookings, clientId, layout:'admin/layout' });
        });
    },

    // --- Settings ---
    getSettings:(req,res)=>{
        db.query("SELECT * FROM settings",(err,results)=>{
            if(err) return res.redirect('/admin/dashboard');
            const settings={}; results.forEach(r=>settings[r.setting_key]=r.setting_value);
            res.render('admin/settings',{settings, path:req.query.success?'success':req.path, layout:'admin/layout'});
        });
    },
    updateSettings:(req,res)=>{
        const {gcash_name,gcash_number,maintenance_mode}=req.body;
        const sql=`UPDATE settings SET setting_value=CASE
            WHEN setting_key='gcash_name' THEN ?
            WHEN setting_key='gcash_number' THEN ?
            WHEN setting_key='maintenance_mode' THEN ?
            END
            WHERE setting_key IN ('gcash_name','gcash_number','maintenance_mode')`;
        db.query(sql,[gcash_name,gcash_number,maintenance_mode||'off'],(err)=>{
            if(err) return res.redirect('/admin/settings?error=1');
            res.redirect('/admin/settings?success=1');
        });
    },

    // Export Reports Controller
    exportReports: (req, res) => {
        const sql = `
            SELECT DATE_FORMAT(booking_date,'%b %Y') AS month,
                SUM(rooms.price) AS monthly_total,
                COUNT(b.id) AS total_bookings
            FROM bookings b
            JOIN rooms ON b.room_id = rooms.id
            WHERE LOWER(b.status)='approved'
            GROUP BY month
            ORDER BY MIN(booking_date) ASC
        `;

        db.query(sql, (err, results) => {
            if (err) return res.status(500).send('Error generating report');

            const fields = ['month','monthly_total','total_bookings'];
            const parser = new Parser({ fields });
            const csv = parser.parse(results);

            res.header('Content-Type', 'text/csv');
            res.attachment('reports.csv');
            res.send(csv);
        });
    }

};

module.exports = adminController;