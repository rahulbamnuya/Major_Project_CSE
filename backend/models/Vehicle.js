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
  },
  vehicle_type: {
    type: String,
    enum: ['SMALL', 'MEDIUM', 'LARGE'],
    default: 'LARGE'
  }
});

// Auto-classify based on capacity if not specified
VehicleSchema.pre('save', function(next) {
  // Only auto-classify if vehicle_type wasn't manually changed from default or is new
  // Note: We use 1000 and 4000 as backend defaults to match frontend Settings defaults
  if (this.isNew || this.isModified('capacity')) {
      if (this.capacity <= 1000) {
          this.vehicle_type = 'SMALL';
      } else if (this.capacity <= 4000) {
          this.vehicle_type = 'MEDIUM';
      } else {
          this.vehicle_type = 'LARGE';
      }
  }
  next();
});

module.exports = mongoose.model('Vehicle', VehicleSchema);