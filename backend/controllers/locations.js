const Location = require('../models/Location');

// Get all locations
exports.getLocations = async (req, res) => {
  try {
    const locations = await Location.find({ user: req.user.id }).sort({ date: -1 });
    res.json(locations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get location by ID
exports.getLocationById = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    
    if (!location) {
      return res.status(404).json({ msg: 'Location not found' });
    }
    if (location.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    res.json(location);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Location not found' });
    }
    res.status(500).send('Server error');
  }
};

// Create location
exports.createLocation = async (req, res) => {
  // ================== DESTRUCTURE NEW FIELDS ==================
  const { 
    name, 
    address, 
    latitude, 
    longitude, 
    demand, 
    isDepot,
    serviceTime,
    timeWindowStart,
    timeWindowEnd
  } = req.body;
  // ==========================================================
  
  try {
    const newLocation = new Location({
      name,
      address,
      latitude,
      longitude,
      demand: demand || 0,
      isDepot: isDepot || false,
      // ================== SAVE NEW FIELDS ==================
      serviceTime: serviceTime || 0,
      timeWindowStart: timeWindowStart, // Will be null if not provided
      timeWindowEnd: timeWindowEnd,     // Will be null if not provided
      // =====================================================
      user: req.user.id
    });
    
    const location = await newLocation.save();
    res.json(location);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Update location
exports.updateLocation = async (req, res) => {
  // ================== DESTRUCTURE NEW FIELDS ==================
  const { 
    name, 
    address, 
    latitude, 
    longitude, 
    demand, 
    isDepot,
    serviceTime,
    timeWindowStart,
    timeWindowEnd
  } = req.body;
  // ==========================================================
  
  try {
    let location = await Location.findById(req.params.id);
    
    if (!location) {
      return res.status(404).json({ msg: 'Location not found' });
    }
    if (location.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    // Build the update object
    const updateFields = {
        name,
        address,
        latitude,
        longitude,
        demand,
        isDepot,
        serviceTime,
        timeWindowStart,
        timeWindowEnd
    };
    
    // Filter out undefined fields so we don't overwrite existing data with nothing
    Object.keys(updateFields).forEach(key => {
        if (updateFields[key] === undefined) {
            delete updateFields[key];
        }
    });

    location = await Location.findByIdAndUpdate(
        req.params.id,
        { $set: updateFields },
        { new: true } // This option returns the updated document
    );

    res.json(location);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Location not found' });
    }
    res.status(500).send('Server error');
  }
};

// Delete location
exports.deleteLocation = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    
    if (!location) {
      return res.status(404).json({ msg: 'Location not found' });
    }
    if (location.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    await Location.deleteOne({ _id: req.params.id, user: req.user.id });
    res.json({ msg: 'Location removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Location not found' });
    }
    res.status(500).send('Server error');
  }
};