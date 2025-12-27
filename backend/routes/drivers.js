const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const driverController = require('../controllers/drivers');

// Apply auth middleware to all routes except portal
// Start with manager routes
router.get('/', auth, driverController.getDrivers);
router.post('/', auth, driverController.createDriver);
router.get('/:id', auth, driverController.getDriverById);
router.put('/:id', auth, driverController.updateDriver);
router.delete('/:id', auth, driverController.deleteDriver);

// Driver Portal Route (Public/Semi-protected)
// Using POST so we can send license number in body securely
router.post('/portal', driverController.getDriverRoutes);

module.exports = router;
