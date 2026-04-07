// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();
const app = express();

// Middleware
app.use(express.json());

// DEVELOPMENT-friendly CORS: allow localhost frontends (adjust for prod)
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (curl, mobile apps, postman)
    if (!origin) return callback(null, true);
    const allowed = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://majorprojectcse-production.up.railway.app', // New production URL
      'https://complexrouteoptimizer.netlify.app',
      'https://logistics-master.vercel.app',
      process.env.FRONTEND_URL,
    ].filter(Boolean);
    if (allowed.includes(origin)) return callback(null, true);
    // for debug, allow all - comment out in production
    // return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Security headers set at the HTTP level. X-Frame-Options MUST be sent as a response header
// (browsers ignore or reject setting it via <meta> tags).
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Import routes (wrap in try to surface errors early)
try {
  const authRoutes = require('./routes/auth');
  const vehicleRoutes = require('./routes/vehicles');
  const locationRoutes = require('./routes/locations');
  const optimizationRoutes = require('./routes/optimization');
  const driverRoutes = require('./routes/drivers');
  // ensure this file exists
  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/vehicles', vehicleRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/optimization', optimizationRoutes);
  app.use('/api/drivers', driverRoutes);

  console.log('✅ Routes mounted: /api/auth, /api/vehicles, /api/locations, /api/optimization, /api/drivers');
} catch (err) {
  console.error('Error importing routes:', err);
  // continue — but server may not work as expected
}

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ Could not connect to MongoDB', err);
    process.exit(1);
  });

// Simple 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Generic error handler (so frontend sees JSON errors)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
