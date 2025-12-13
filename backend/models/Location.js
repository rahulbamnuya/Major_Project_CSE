const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  demand: {
    type: Number,
    default: 0
  },
  isDepot: {
    type: Boolean,
    default: false
  },
   timeWindowStart: {
    type: Number, // Stored as minutes from midnight (e.g., 9 AM = 540)
    default: null, // Null means no time window constraint
  },
  timeWindowEnd: {
    type: Number, // Stored as minutes from midnight (e.g., 5 PM = 1020)
    default: null,
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Location', LocationSchema);