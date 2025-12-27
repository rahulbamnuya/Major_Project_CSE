const Vehicle = require('../models/Vehicle');

// Get all vehicles
exports.getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ user: req.user.id }).sort({ date: -1 });
    res.json(vehicles);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get vehicle by ID
exports.getVehicleById = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    // Check if vehicle exists
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    // Check user
    if (vehicle.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    res.json(vehicle);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }
    res.status(500).send('Server error');
  }
};

// Create vehicle
exports.createVehicle = async (req, res) => {
  const {
    name,
    capacity,
    count = 1,
    maxDistance,
    fuel_cost_per_km,
    driver_cost_per_km,
    average_speed,
    start_time,
    end_time
  } = req.body;

  try {
    // Safety checks
    if (!name || !capacity) {
      return res.status(400).json({ message: 'Name and capacity are required' });
    }

    // Get user id (from token or middleware)
    const userId = req.user?.id || null; // adjust depending on your auth setup

    // If count > 1, create multiple vehicles
    let vehiclesToInsert = [];

    for (let i = 1; i <= count; i++) {
      const suffix = count > 1 ? `-${i}` : '';
      vehiclesToInsert.push({
        name: `${name}${suffix}`,
        capacity,
        count: 1, // each individual vehicle is one instance
        maxDistance,
        fuel_cost_per_km,
        driver_cost_per_km,
        average_speed,
        start_time,
        end_time,
        user: userId
      });
    }

    // Insert all at once
    const createdVehicles = await Vehicle.insertMany(vehiclesToInsert);

    // Return all newly created vehicles
    res.status(201).json({
      message: `${createdVehicles.length} vehicle(s) created successfully`,
      vehicles: createdVehicles
    });

  } catch (err) {
    console.error('createVehicle error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Update vehicle
exports.updateVehicle = async (req, res) => {
  const {
    name,
    capacity,
    count,
    maxDistance,
    fuel_cost_per_km,
    driver_cost_per_km,
    average_speed,
    start_time,
    end_time
  } = req.body;

  try {
    let vehicle = await Vehicle.findById(req.params.id);

    // Check if vehicle exists
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    // Check user
    if (vehicle.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    // Update fields
    vehicle.name = name || vehicle.name;
    vehicle.capacity = capacity || vehicle.capacity;
    vehicle.count = count || vehicle.count;
    vehicle.maxDistance = maxDistance || vehicle.maxDistance;
    if (fuel_cost_per_km !== undefined) vehicle.fuel_cost_per_km = fuel_cost_per_km;
    if (driver_cost_per_km !== undefined) vehicle.driver_cost_per_km = driver_cost_per_km;
    if (average_speed !== undefined) vehicle.average_speed = average_speed;
    if (start_time !== undefined) vehicle.start_time = start_time;
    if (end_time !== undefined) vehicle.end_time = end_time;

    await vehicle.save();
    res.json(vehicle);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }
    res.status(500).send('Server error');
  }
};

// Delete vehicle
exports.deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    // Check if vehicle exists
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    // Check user
    if (vehicle.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    await Vehicle.deleteOne({ _id: req.params.id, user: req.user.id });
    res.json({ msg: 'Vehicle removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }
    res.status(500).send('Server error');
  }
};