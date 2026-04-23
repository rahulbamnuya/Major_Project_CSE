// /algorithms/orTools.js
const axios = require('axios');
const { clarkeWrightAlgorithmWithTimeWindows } = require('./clarkeWright');
const { enhancedClarkeWrightAlgorithm } = require('./enhancedClarkeWright');

exports.orToolsAlgorithm = async (vehicles, locations, depot, options = {}) => {
  const { useTimeWindows = false, avgSpeedKmh = 25, strategy = 'hybrid', smallThreshold = 1000, mediumThreshold = 4000 } = options;

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
        road_type: loc.road_type || 'STANDARD',
      })),
      vehicles: vehicles.map(v => ({
        id: v._id.toString(),
        capacity: v.capacity,
        average_speed: parseFloat(v.average_speed) || avgSpeedKmh,
        vehicle_type: v.vehicle_type
      })),
      demands: allLocations.map(loc => loc.demand || 0),
      include_geometry: true,
      time_limit_seconds: 30,
      useTimeWindows: useTimeWindows,
      traffic_factor: 1.25,
      avg_speed_kmh: avgSpeedKmh, // Send average speed from frontend
      strategy: strategy,
      small_threshold: smallThreshold,
      medium_threshold: mediumThreshold,
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

      const routes = response.data.result.map(route => {
        const rawVehicleId = route['Vehicle ID'].split('_Trip')[0];
        const vehicle = vehicles.find(v => v._id.toString() === rawVehicleId);
        const routeIndices = route['Route Indices'] || [];
        const arrivalTimes = route['Arrival Times (seconds)'] || [];
        const serviceTimes = route['Service Times (seconds)'] || [];

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
            arrivalTime: arrivalTimes[order] ?? null,
            serviceTime: serviceTimes[order] ?? null,
            timeWindowStart: loc.timeWindow ? loc.timeWindow[0] * 60 : null,
            timeWindowEnd: loc.timeWindow ? loc.timeWindow[1] * 60 : null,
            road_type: loc.road_type || 'STANDARD',
          };
        }).filter(Boolean);

        return {
          vehicle: rawVehicleId,
          vehicleName: vehicle?.name ? `${vehicle.name} (${route['Vehicle ID'].includes('_Trip') ? 'Trip ' + route['Vehicle ID'].split('_Trip')[1] : 'Trip 1'})` : `Vehicle ${route['Vehicle ID']}`,
          distance: route['Distance (km)'] || 0,
          duration: Math.round((route['Duration (seconds)'] || 0) / 60),
          totalCapacity: route['Load Carried'] || 0,
          stops,
          routeGeometry: route['Route Geometry'] || [],
        };
      });

      return {
        routes,
        droppedNodes: response.data.dropped_nodes || []
      };
    }

    console.warn('⚠️ Python API did not return a valid result, falling back...');
    const fallBackRoutes = await enhancedClarkeWrightAlgorithm(vehicles, locations, depot);
    return { routes: fallBackRoutes, droppedNodes: [] };

  } catch (error) {
    console.error('❌ Error calling Python VRP solver:', error.message);
    console.log('🔁 Falling back to Clarke-Wright due to API error.');
    const fallBackRoutes = await clarkeWrightAlgorithmWithTimeWindows(vehicles, locations, depot, useTimeWindows);
    return { routes: fallBackRoutes, droppedNodes: [] };
  }
};