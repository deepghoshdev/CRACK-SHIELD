require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
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

// POST - Save new crack + emit real-time alert
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

        res.status(201).json({ success: true, message: "Crack data saved!", data: newCrack });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// Keep alive - free tier ke liye
const https = require('https');
setInterval(() => {
    https.get('https://crack-shield.onrender.com/api/cracks', (res) => {
        console.log('🏓 Keep-alive ping sent:', res.statusCode);
    }).on('error', (err) => {
        console.log('Keep-alive error:', err.message);
    });
}, 600000); // har 10 minute mein

server.listen(PORT, () => {
    console.log(`🛡️ CrackShield Server is running on: http://localhost:${PORT}`);
});