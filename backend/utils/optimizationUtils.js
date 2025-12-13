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
 */
exports.assignVehiclesToRoutes = (routes, vehicles) => {
  const vehicleSlots = [];
  vehicles.forEach((v) => {
    const count = v.count || 1;
    for (let i = 0; i < count; i++) {
      vehicleSlots.push({
        _id: v._id,
        name: v.name,
        capacity: v.capacity || 0,
        used: false,
        currentLoad: 0
      });
    }
  });

  routes.sort((a, b) => (b.totalCapacity || 0) - (a.totalCapacity || 0));
  vehicleSlots.sort((a, b) => b.capacity - a.capacity);

  for (const route of routes) {
    const bestSlot = vehicleSlots
      .filter(vs => !vs.used && vs.capacity >= (route.totalCapacity || 0))
      .sort((a, b) => (a.capacity - (route.totalCapacity || 0)) - (b.capacity - (route.totalCapacity || 0)))[0];

    if (bestSlot) {
      route.vehicle = bestSlot._id;
      route.vehicleName = bestSlot.name;
      bestSlot.used = true;
    }
  }
  return routes;
};