// /algorithms/orTools.js
const axios = require('axios');
const { clarkeWrightAlgorithmWithTimeWindows } = require('./clarkeWright');
const { enhancedClarkeWrightAlgorithm } = require('./enhancedClarkeWright');

exports.orToolsAlgorithm = async (vehicles, locations, depot, options = {}) => {
  const { useTimeWindows = false, avgSpeedKmh = 25 } = options;

  // Use local Python API for development
  // For production, use: 'https://major-project-cse-222.onrender.com/optimize'
  const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000/optimize';

  try {
    // Ensure depot is included in locations array for Python API
    const allLocations = [depot, ...locations];

    const requestData = {
      locations: allLocations.map(loc => ({
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        serviceTime: loc.serviceTime || 0, // in minutes
        timeWindowStart: loc.timeWindow ? loc.timeWindow[0] : null, // in minutes
        timeWindowEnd: loc.timeWindow ? loc.timeWindow[1] : null, // in minutes
      })),
      vehicles: vehicles.map(v => ({
        id: v._id.toString(),
        capacity: v.capacity
      })),
      demands: allLocations.map(loc => loc.demand || 0),
      include_geometry: true,
      time_limit_seconds: 30,
      useTimeWindows: useTimeWindows,
      traffic_factor: 1.25,
      avg_speed_kmh: avgSpeedKmh, // Send average speed from frontend
    };

    // Ensure depot is at index 0 and has zero demand
    if (requestData.demands.length > 0) requestData.demands[0] = 0;

    console.log('📤 Sending data to Python VRP solver...');
    console.log(`   Depot: ${depot.name}`);
    console.log(`   Locations (including depot): ${requestData.locations.length}`);
    console.log(`   Vehicles: ${vehicles.length}`);
    const response = await axios.post(PYTHON_API_URL, requestData);

    if (response.data?.result) {
      console.log('✅ Received VRP solution from Python API');

      console.log('✅ Received VRP solution from Python API');

      // Use the same locations array structure that we sent to Python: [depot, ...locations]
      // This ensures Index 0 maps to Depot, Index 1 to first customer, etc.
      const mappingLocations = [depot, ...locations];

      return response.data.result.map(route => {
        const vehicle = vehicles.find(v => v._id.toString() === route['Vehicle ID']);
        const routeIndices = route['Route Indices'] || [];
        const arrivalTimes = route['Arrival Times (seconds)'] || [];
        const serviceTimes = route['Service Times (seconds)'] || [];

        // --- MAPPING TO THE NEW, CLEAN SCHEMA ---
        const stops = routeIndices.map((locIndex, order) => {
          const loc = mappingLocations[locIndex];
          if (!loc) return null;

          return {
            locationId: loc._id,
            locationName: loc.name,
            latitude: loc.latitude,
            longitude: loc.longitude,
            demand: loc.demand || 0,
            order,
            // Storing all time data directly on the stop object in SECONDS
            arrivalTime: arrivalTimes[order] ?? null,
            serviceTime: serviceTimes[order] ?? null,
            timeWindowStart: loc.timeWindow ? loc.timeWindow[0] * 60 : null,
            timeWindowEnd: loc.timeWindow ? loc.timeWindow[1] * 60 : null,
          };
        }).filter(Boolean);

        return {
          vehicle: route['Vehicle ID'],
          vehicleName: vehicle?.name || `Vehicle ${route['Vehicle ID']}`,
          distance: route['Distance (km)'] || 0,
          // Use the duration from the backend and convert to minutes for DB storage
          duration: Math.round((route['Duration (seconds)'] || 0) / 60),
          totalCapacity: route['Load Carried'] || 0,
          stops, // The clean, correct stops array
          routeGeometry: route['Route Geometry'] || [],
        };
      });
    }

    console.warn('⚠️ Python API did not return a valid result, falling back...');
    return enhancedClarkeWrightAlgorithm(vehicles, locations, depot);

  } catch (error) {
    console.error('❌ Error calling Python VRP solver:', error.message);
    if (error.response?.data) console.error('Response data:', error.response.data);
    console.log('🔁 Falling back to Clarke-Wright due to API error.');
    return clarkeWrightAlgorithmWithTimeWindows(vehicles, locations, depot, useTimeWindows);
  }
};