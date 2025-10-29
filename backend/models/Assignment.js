const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
  externalId: String, // optional reference id
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  route: [{
    location: {
      type: { type: String, enum: ['Point'], default:'Point' },
      coordinates: { type: [Number], required: true } // [lng, lat]
    },
    sequence: Number,
    address: String,
    type: { type: String, enum: ['pickup','dropoff'] }
  }],
  status: { type: String, enum: ['pending','assigned','accepted','in_progress','completed','cancelled'], default:'pending' },
  estimatedDistanceKm: Number,
  estimatedDurationMin: Number,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acceptedAt: Date,
  startedAt: Date,
  completedAt: Date,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

module.exports = mongoose.model('Assignment', AssignmentSchema);
