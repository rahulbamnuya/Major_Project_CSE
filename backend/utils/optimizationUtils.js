// /utils/optimizationUtils.js

/**
 * Calculates the Haversine distance between two coordinates in kilometers.
 */
exports.calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (
    typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
    isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)
  ) {
    console.warn('Invalid coordinates for distance calculation:', { lat1, lon1, lat2, lon2 });
    return 0;
  }

  const toRad = (deg) => deg * Math.PI / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 1000) / 1000; // km rounded to 3 decimals
};

/**
 * Calculates the total distance (cost) of a given solution.
 */
exports.calculateTotalCost = (solution, distances) => {
  const toIdLocal = (objId) => objId.toString();
  return solution.reduce((total, route) => {
    let routeCost = 0;
    for (let i = 0; i < route.stops.length - 1; i++) {
      const fromId = toIdLocal(route.stops[i].locationId);
      const toIdStr = toIdLocal(route.stops[i + 1].locationId);
      routeCost += distances[fromId]?.[toIdStr] || 0;
    }
    return total + routeCost;
  }, 0);
};

/**
 * Assigns the best-fitting vehicles to a list of routes based on capacity.
 * Returns an object with assignedRoutes and unassignedStops.
 */
/**
 * Assigns the best-fitting vehicles to a list of routes based on capacity.
 * EXTREME ROBUSTNESS: Stacks any number of routes into multi-trips to prevent drops.
 */
exports.assignVehiclesToRoutes = (routes, vehicles) => {
  // 1. Sort routes by demand (descending) to handle bulkier loads first
  const sortedRoutes = [...routes].sort((a, b) => (b.totalCapacity || 0) - (a.totalCapacity || 0));
  
  // 2. Prepare fleet with numeric capacities and usage counters
  const fleet = vehicles.map(v => ({
    _id: v._id.toString(),
    name: v.name,
    capacity: Number(v.capacity || 0),
    vehicle_type: v.vehicle_type || 'LARGE',
    tripCount: 0,
    lastTripEndTime: 0
  })).sort((a, b) => b.capacity - a.capacity); // Largest first for primary assignment

  const MAX_TRIPS = 12; // Allow deep sequencing
  const assignedRoutes = [];
  const unassignedStops = [];

  console.log(`📡 Dispatcher: Assigning ${sortedRoutes.length} routes to ${fleet.length} vehicles...`);

  for (const route of sortedRoutes) {
    const demand = Number(route.totalCapacity || 0);
    
    // INFRASTRUCTURE AWARENESS: What is the strictest road in this route?
    let strictestRoadType = 'WIDE';
    route.stops.forEach(s => {
       const rt = (s.road_type || 'STANDARD').toUpperCase();
       if (rt === 'NARROW') strictestRoadType = 'NARROW';
       else if (rt === 'STANDARD' && strictestRoadType !== 'NARROW') strictestRoadType = 'STANDARD';
    });

    // Sort fleet to FIND the best vehicle for THIS route
    // Priority: 1. Fewest trips | 2. Infrastructure Compatibility | 3. Efficiency
    const availableFleet = fleet.filter(v => {
      // 1. Capacity Check
      if (v.capacity < demand) return false;
      
      // 2. Max Trip Check
      if (v.tripCount >= MAX_TRIPS) return false;

      // 3. INFRASTRUCTURE CHECK
      const vType = (v.vehicle_type || 'LARGE').toUpperCase();
      if (strictestRoadType === 'NARROW' && vType !== 'SMALL') return false;
      if (strictestRoadType === 'STANDARD' && vType === 'LARGE') return false;

      return true;
    });
    
    availableFleet.sort((a, b) => {
      // Rule 1: Always use a driver who hasn't started yet before giving anyone a 2nd trip
      if (a.tripCount !== b.tripCount) return a.tripCount - b.tripCount;
      // Rule 2: Use the smaller truck to save fuel
      return a.capacity - b.capacity;
    });

    const bestVehicle = availableFleet[0];

    if (bestVehicle) {
      bestVehicle.tripCount++;
      const vIdKey = bestVehicle._id;
      
      const assignedRoute = JSON.parse(JSON.stringify(route));
      assignedRoute.vehicle = vIdKey;
      assignedRoute.vehicle_type = bestVehicle.vehicle_type; // Pass type for UI audit
      assignedRoute.originalVehicleId = bestVehicle._id;
      
      let timeOffsetSeconds = 0;
      const RELOAD_BUFFER = 15 * 60;
      if (bestVehicle.lastTripEndTime > 0) {
        const defaultStart = assignedRoute.stops[0].departureTime || (6 * 3600);
        timeOffsetSeconds = Math.max(0, (bestVehicle.lastTripEndTime + RELOAD_BUFFER) - defaultStart);
      }

      assignedRoute.stops.forEach(stop => {
        if (stop.arrivalTime) stop.arrivalTime += timeOffsetSeconds;
        if (stop.departureTime) stop.departureTime += timeOffsetSeconds;
      });

      assignedRoute.vehicleName = `${bestVehicle.name}${bestVehicle.tripCount > 1 ? ` (Trip ${bestVehicle.tripCount})` : ''}`;
      bestVehicle.lastTripEndTime = assignedRoute.stops[assignedRoute.stops.length - 1].arrivalTime;
      
      assignedRoutes.push(assignedRoute);
      console.log(`✅ Dispatch: ${assignedRoute.vehicleName} assigned ${demand}kg (Ends: ${new Date(bestVehicle.lastTripEndTime * 1000).toISOString().substr(11,5)})`);
    } else {
      const customerStops = route.stops.filter((s, idx) => idx !== 0 && idx !== route.stops.length - 1);
      customerStops.forEach(s => {
        unassignedStops.push({
          locationId: s.locationId,
          locationName: s.locationName,
          reason: 'Oversized Load or Fleet Exhausted'
        });
      });
    }
  }

  return { assignedRoutes, unassignedStops };
};