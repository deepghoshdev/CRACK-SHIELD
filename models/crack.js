const mongoose = require('mongoose');

// Database Schema - Big Tech standards ke mutabik fixed structure
const CrackSchema = new mongoose.Schema({
    date: { type: String, required: true },
    time: { type: String, required: true },
    latitude: { type: String, required: true },
    longitude: { type: String, required: true },
    googleMapLink: { type: String, required: true },
    severity: { 
    type: String, 
    enum: ['MINOR', 'MODERATE', 'CRITICAL'], 
    default: 'MINOR' 
},
    createdAt: { type: Date, default: Date.now } // Taaki pta rahe kab entry hui
});

module.exports = mongoose.model('Crack', CrackSchema);