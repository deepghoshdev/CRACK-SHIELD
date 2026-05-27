require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const Crack = require('./models/crack.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Map page route
app.get('/map', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'map.html'));
});

// MongoDB Connect
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("💾 MongoDB Atlas Cloud Connected Successfully!"))
    .catch(err => console.error("❌ Database Connection Error:", err));

// Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Email Alert Function
async function sendCrackAlert(crackData) {
    const severityColor = {
        'CRITICAL': '#ff0000',
        'MODERATE': '#ff9900',
        'MINOR': '#ffcc00'
    };
    const color = severityColor[crackData.severity] || '#ff4444';

    const mailOptions = {
        from: `"🛡️ CrackShield Alert" <${process.env.EMAIL_USER}>`,
        to: process.env.ALERT_EMAIL,
        subject: `🚨 ${crackData.severity} ALERT — Railway Track Crack Detected!`,
        html: `
        <div style="font-family: Arial; background: #1a1a1a; color: white; padding: 30px; border-radius: 12px; max-width: 600px;">
            <div style="background: ${color}; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                <h1 style="margin:0; font-size: 24px;">⚠️ ${crackData.severity} CRACK DETECTED!</h1>
                <p style="margin:5px 0 0 0;">Immediate Inspection Required</p>
            </div>
            <table style="width:100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #333;">
                    <td style="padding:12px; color:#aaa;">📅 Date</td>
                    <td style="padding:12px; font-weight:bold;">${crackData.date}</td>
                </tr>
                <tr style="border-bottom: 1px solid #333;">
                    <td style="padding:12px; color:#aaa;">⏰ Time</td>
                    <td style="padding:12px; font-weight:bold;">${crackData.time}</td>
                </tr>
                <tr style="border-bottom: 1px solid #333;">
                    <td style="padding:12px; color:#aaa;">📍 Latitude</td>
                    <td style="padding:12px; font-weight:bold;">${crackData.latitude}</td>
                </tr>
                <tr style="border-bottom: 1px solid #333;">
                    <td style="padding:12px; color:#aaa;">📍 Longitude</td>
                    <td style="padding:12px; font-weight:bold;">${crackData.longitude}</td>
                </tr>
                <tr style="border-bottom: 1px solid #333;">
                    <td style="padding:12px; color:#aaa;">⚠️ Severity</td>
                    <td style="padding:12px;">
                        <span style="background:${color}; color:white; padding:4px 12px; border-radius:20px; font-weight:bold;">
                            ${crackData.severity}
                        </span>
                    </td>
                </tr>
                <tr>
                    <td style="padding:12px; color:#aaa;">🗺️ Map</td>
                    <td style="padding:12px;">
                        <a href="${crackData.googleMapLink}" 
                           style="background:#4CAF50; color:white; padding:8px 16px; border-radius:5px; text-decoration:none;">
                           View on Google Maps
                        </a>
                    </td>
                </tr>
            </table>
            <div style="margin-top:20px; padding:15px; background:#2a2a2a; border-radius:8px; text-align:center;">
                <p style="margin:0; color:#aaa; font-size:12px;">🛡️ CrackShield — Railway Track Monitoring System</p>
            </div>
        </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('📧 Alert email sent to:', process.env.ALERT_EMAIL);
    } catch (error) {
        console.error('❌ Email error:', error.message);
    }
}

// Socket.io connection
io.on('connection', (socket) => {
    console.log('📡 Dashboard connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('📡 Dashboard disconnected:', socket.id);
    });
});

// GET - Fetch all cracks
app.get('/api/cracks', async (req, res) => {
    try {
        const crackRecords = await Crack.find().sort({ createdAt: -1 });
        res.json({ success: true, count: crackRecords.length, data: crackRecords });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST - Save new crack + emit real-time alert + send email
app.post('/api/cracks', async (req, res) => {
    try {
        const date = req.body.date || req.query.date;
        const time = req.body.time || req.query.time;
        const latitude = req.body.latitude || req.query.lat || req.query.latitude;
        const longitude = req.body.longitude || req.query.lng || req.query.longitude;

        if (!date || !time || !latitude || !longitude) {
            return res.status(400).json({ success: false, message: "Missing required fields!" });
        }

        const googleMapLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

        // Severity auto-detect logic
        const sensorValue = parseFloat(req.body.sensor || req.query.sensor || 0);
        let severity = 'MINOR';
        if (sensorValue >= 5) severity = 'CRITICAL';
        else if (sensorValue >= 2) severity = 'MODERATE';

        const newCrack = new Crack({ date, time, latitude, longitude, googleMapLink, severity });
        await newCrack.save();

        console.log("⚠️ NEW CRACK SAVED:", newCrack);

        // 🔥 Real-time alert to all dashboards
        io.emit('crack_detected', {
            date, time, latitude, longitude, googleMapLink, severity
        });

        // 📧 Email alert
        await sendCrackAlert({ date, time, latitude, longitude, googleMapLink, severity });

        res.status(201).json({ success: true, message: "Crack data saved!", data: newCrack });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Keep alive - free tier ke liye
setInterval(() => {
    https.get('https://crack-shield.onrender.com/api/cracks', (res) => {
        console.log('🏓 Keep-alive ping sent:', res.statusCode);
    }).on('error', (err) => {
        console.log('Keep-alive error:', err.message);
    });
}, 600000); // har 10 minute mein

// Test Email Route
app.get('/test-email', async (req, res) => {
    try {
        await sendCrackAlert({
            date: '2026-05-27',
            time: '08:00 PM',
            latitude: '22.5726',
            longitude: '88.3639',
            googleMapLink: 'https://maps.google.com',
            severity: 'CRITICAL'
        });
        res.json({ message: '✅ Test email sent successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
server.listen(PORT, () => {
    console.log(`🛡️ CrackShield Server is running on: http://localhost:${PORT}`);
});