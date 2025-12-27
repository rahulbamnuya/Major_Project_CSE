const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  capacity: {
    type: Number,
    required: true
  },
  count: {
    type: Number,
    required: true,
    default: 1
  },
  maxDistance: {
    type: Number,
    default: 100000 // 100km in meters
  },
  date: {
    type: Date,
    default: Date.now
  },
  // New cost and operational fields
  fuel_cost_per_km: {
    type: Number,
    default: 10 // Default cost
  },
  driver_cost_per_km: {
    type: Number,
    default: 8 // Default cost
  },
  average_speed: {
    type: Number,
    default: 40 // Default km/h
  },
  start_time: {
    type: String, // HH:MM format
    default: "08:00"
  },
  end_time: {
    type: String, // HH:MM format
    default: "20:00"
  }
});

module.exports = mongoose.model('Vehicle', VehicleSchema);