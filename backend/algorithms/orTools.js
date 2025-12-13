// /algorithms/orTools.js
const axios = require('axios');
const { clarkeWrightAlgorithmWithTimeWindows} = require('./clarkeWright');
const { enhancedClarkeWrightAlgorithm } = require('./enhancedClarkeWright');

exports.orToolsAlgorithm = async (vehicles, locations, depot, useTimeWindows = false) => {
  // const PYTHON_API_URL = 'http://127.0.0.1:8000/optimize';
  const PYTHON_API_URL = 'https://major-project-cse-222.onrender.com/optimize';

  try {
    const requestData = {
      locations: locations.map(loc => ({
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
      demands: locations.map(loc => loc.demand || 0),
      include_geometry: true,
      time_limit_seconds: 30,
      useTimeWindows: useTimeWindows,
      traffic_factor: 1.25, // Sending our new traffic factor
    };

    const depotIndex = requestData.locations.findIndex(loc => loc.name === depot.name);
    if (depotIndex > 0) {
      const depotLoc = requestData.locations.splice(depotIndex, 1)[0];
      requestData.locations.unshift(depotLoc);
      const depotDemand = requestData.demands.splice(depotIndex, 1)[0];
      requestData.demands.unshift(depotDemand);
    }
    if (requestData.demands.length > 0) requestData.demands[0] = 0;

    console.log('📤 Sending data to Python VRP solver...');
    const response = await axios.post(PYTHON_API_URL, requestData);

    if (response.data?.result) {
      console.log('✅ Received VRP solution from Python API');

      const originalLocations = [...locations];
      if (depotIndex > 0) {
          const depotLoc = originalLocations.splice(depotIndex, 1)[0];
          originalLocations.unshift(depotLoc);
      }

      return response.data.result.map(route => {
        const vehicle = vehicles.find(v => v._id.toString() === route['Vehicle ID']);
        const routeIndices = route['Route Indices'] || [];
        const arrivalTimes = route['Arrival Times (seconds)'] || [];
        const serviceTimes = route['Service Times (seconds)'] || [];

        // --- MAPPING TO THE NEW, CLEAN SCHEMA ---
        const stops = routeIndices.map((locIndex, order) => {
          const loc = originalLocations[locIndex];
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