const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    driverId: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: true
    },
    email: {
        type: String
    },
    licenseNumber: {
        type: String,
        required: true
    },
    address: {
        type: String
    },
    status: {
        type: String,
        enum: ['Available', 'On Route', 'Offline'],
        default: 'Available'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Driver', DriverSchema);
