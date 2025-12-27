// models/Optimization.js

const mongoose = require('mongoose');

/**
 * Sub-schema for a single stop within a route.
 * This is now the SINGLE SOURCE OF TRUTH for stop-level data.
 */
const StopSchema = new mongoose.Schema({
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  locationName: String,
  latitude: Number,
  longitude: Number,
  demand: Number,
  order: Number,
  // Time values are stored in SECONDS for precision
  arrivalTime: Number,
  serviceTime: Number,
  timeWindowStart: Number,
  timeWindowEnd: Number,
  status: {
    type: String,
    enum: ['Pending', 'En Route', 'Arrived', 'Delivered', 'Failed'],
    default: 'Pending'
  },
  proofOfDelivery: {
    signature: String, // Base64 or URL
    photo: String, // URL
    timestamp: Date
  }
}, { _id: false });

/**
 * Sub-schema for a single vehicle route.
 * --- SIMPLIFIED: Removed redundant top-level time arrays ---
 */
const RouteSchema = new mongoose.Schema({
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  vehicleName: String,
  stops: [StopSchema],
  distance: Number, // in km
  duration: Number, // in minutes
  totalCapacity: Number,
  routeGeometry: { // Store the geometry for mapping
    type: [[Number]],
    default: undefined
  },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' }
}, { _id: false });

// ... (AlgorithmResultSchema and OptimizationSchema remain structurally the same but will now use the corrected RouteSchema)

const AlgorithmResultSchema = new mongoose.Schema({
  algorithm: String,
  algorithmKey: String,
  routes: [RouteSchema],
  totalDistance: Number,
  totalDuration: Number,
  executionTime: Number,
  error: String,
});

const OptimizationSchema = new mongoose.mongoose.Schema({
  name: { type: String, required: true, trim: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' }],
  locations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],
  selectedAlgorithm: String,
  algorithmResults: [AlgorithmResultSchema],
  routes: [RouteSchema],
  totalDistance: Number,
  totalDuration: Number,
}, { timestamps: true });

module.exports = mongoose.model('Optimization', OptimizationSchema);