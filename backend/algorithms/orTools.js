// /algorithms/orTools.js
const axios = require('axios');
const { clarkeWrightAlgorithmWithTimeWindows } = require('./clarkeWright');
const { enhancedClarkeWrightAlgorithm } = require('./enhancedClarkeWright');

exports.orToolsAlgorithm = async (vehicles, locations, depot, options = {}) => {
  const { useTimeWindows = false, avgSpeedKmh = 25, strategy = 'hybrid', smallThreshold = 1000, mediumThreshold = 4000 } = options;

  // Use local Python API for development
  const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000/optimize';

  try {
    const allLocations = [depot, ...locations];

    const requestData = {
      locations: allLocations.map(loc => ({
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        serviceTime: loc.serviceTime || 0,
        timeWindowStart: loc.timeWindowStart !== undefined ? loc.timeWindowStart : null,
        timeWindowEnd: loc.timeWindowEnd !== undefined ? loc.timeWindowEnd : null,
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
      avg_speed_kmh: avgSpeedKmh,
      strategy: strategy,
      small_threshold: smallThreshold,
      medium_threshold: mediumThreshold,
    };

    if (requestData.demands.length > 0) requestData.demands[0] = 0;

    console.log('📤 Sending data to Python VRP solver...');
    const response = await axios.post(PYTHON_API_URL, requestData);

    if (response.data?.result) {
      console.log('✅ Received VRP solution from Python API');
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
            startTimeWindowSeconds: (loc.timeWindowStart != null ? loc.timeWindowStart * 60 : null) || (6 * 3600),
            endTimeWindowSeconds: (loc.timeWindowEnd != null ? loc.timeWindowEnd * 60 : null) || (22 * 3600),
            timeWindowStart: (loc.timeWindowStart != null ? loc.timeWindowStart * 60 : null) || (6 * 3600),
            timeWindowEnd: (loc.timeWindowEnd != null ? loc.timeWindowEnd * 60 : null) || (22 * 3600),
            goalTime: (loc.timeWindowEnd != null ? loc.timeWindowEnd * 60 : null) || (22 * 3600),
            road_type: loc.road_type || 'STANDARD',
          };
        }).filter(Boolean);

        const r = {
          vehicle: rawVehicleId,
          vehicleName: vehicle?.name ? `${vehicle.name} (${route['Vehicle ID'].includes('_Trip') ? 'Trip ' + route['Vehicle ID'].split('_Trip')[1] : 'Trip 1'})` : `Vehicle ${route['Vehicle ID']}`,
          distance: route['Distance (km)'] || 0,
          duration: Math.round((route['Duration (seconds)'] || 0) / 60),
          totalCapacity: route['Load Carried'] || 0,
          stops,
          routeGeometry: route['Route Geometry'] || [],
          timeWindowApplied: useTimeWindows,
          timeViolationCount: 0,
          isViolated: false
        };

        // Post-process violations
        r.stops.forEach(s => {
          if (useTimeWindows && s.goalTime && s.arrivalTime > s.goalTime) {
            r.isViolated = true;
            r.timeViolationCount++;
            s.isLate = true;
          }
        });
        if (r.stops.length > 0 && r.stops[r.stops.length - 1].arrivalTime > (22 * 3600)) {
          r.isViolated = true;
          r.timeViolationCount++;
          r.stops[r.stops.length - 1].isLate = true;
        }

        return r;
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
    const fallBackRoutes = await clarkeWrightAlgorithmWithTimeWindows(vehicles, locations, depot, { useTimeWindows });
    return { routes: fallBackRoutes, droppedNodes: [] };
  }
};