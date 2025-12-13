const { calculateDistance } = require('../utils/optimizationUtils');
const { improveRouteWithLocalSearch } = require('./localSearch');

// =================================================================
// CONSTANTS
// =================================================================
const BASE_SPEED_KMH = 40;
const TRAFFIC_FACTOR = 1.25;
const DEPOT_START_TIME_SECONDS = 6 * 3600; // 6:00 AM
const DEPOT_END_TIME_SECONDS = 18 * 3600; // 6:00 PM
const BASE_SERVICE_TIME_SECONDS = 3 * 60; // 3 minutes
const UNITS_PER_SECOND_OF_UNLOADING = 10 / 60; // 10 units per minute

const toId = (id) => id.toString();

// =================================================================
// HELPER FUNCTIONS
// =================================================================
const computeTravelTime = (distanceMeters) =>
  ((distanceMeters / (BASE_SPEED_KMH * 1000)) * 3600) * TRAFFIC_FACTOR;

const formatTimeWindow = (start, end) => ({
  startTimeWindowSeconds: start != null ? start * 60 : DEPOT_START_TIME_SECONDS,
  endTimeWindowSeconds: end != null ? end * 60 : DEPOT_END_TIME_SECONDS,
});

// =================================================================
// MAIN FUNCTION
// =================================================================
// FIX 1: The function name now matches what the controller imports.
exports.clarkeWrightAlgorithmWithTimeWindows = (vehicles, locations, depot, options = {}) => {
  const useTimeWindows = options.useTimeWindows || false;
  console.log("🚚 Running Clarke-Wright Algorithm with Time Windows and Traffic...");

  // FIX 2: Combine depot and locations to build a complete distance matrix.
  const allNodes = [depot, ...locations];
  const depotId = toId(depot._id);

  // -----------------------------------------------------------------
  // Build distance matrix from ALL nodes (depot + locations)
  // -----------------------------------------------------------------
  const distances = {};
  allNodes.forEach((l1) => {
    const id1 = toId(l1._id);
    distances[id1] = {};
    allNodes.forEach((l2) => {
      const id2 = toId(l2._id);
      distances[id1][id2] = calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
    });
  });

  const nonDepot = locations.filter((l) => toId(l._id) !== depotId);
  const maxCapacity = Math.max(...vehicles.map((v) => v.capacity || 0));

  // -----------------------------------------------------------------
  // Step 1: Initial single-customer routes
  // -----------------------------------------------------------------
  const makeDepotStop = (order) => ({
    locationId: depot._id,
    locationName: depot.name,
    latitude: depot.latitude,
    longitude: depot.longitude,
    demand: 0,
    order,
    ...formatTimeWindow(depot.timeWindowStart, depot.timeWindowEnd),
  });

  let routes = nonDepot.map((loc) => {
    const locTimeWindow = useTimeWindows
      ? formatTimeWindow(loc.timeWindowStart, loc.timeWindowEnd)
      : formatTimeWindow(0, 1440); // Default to all day if not using TW

    const serviceTime =
      BASE_SERVICE_TIME_SECONDS + (loc.demand || 0) / UNITS_PER_SECOND_OF_UNLOADING;

    const stops = [
      makeDepotStop(0),
      {
        locationId: loc._id,
        locationName: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        demand: loc.demand || 0,
        order: 1,
        serviceTime,
        ...locTimeWindow,
      },
      makeDepotStop(2),
    ];

    const route = {
      vehicle: undefined,
      vehicleName: 'Unassigned',
      stops,
      totalCapacity: loc.demand || 0,
    };
    // Calculate initial timing for feasibility
    recomputeTimesAndDistance(route, distances, useTimeWindows);
    return route;
  });

  // IMPROVEMENT: Filter out any initially infeasible routes.
  routes = routes.filter(r => !r.isViolated);

  // -----------------------------------------------------------------
  // Step 2: Compute Savings
  // -----------------------------------------------------------------
  const savings = [];
  for (let i = 0; i < nonDepot.length; i++) {
    for (let j = i + 1; j < nonDepot.length; j++) {
      const li = nonDepot[i];
      const lj = nonDepot[j];
      const saving =
        distances[depotId][toId(li._id)] +
        distances[depotId][toId(lj._id)] -
        distances[toId(li._id)][toId(lj._id)];
      savings.push({ i: li, j: lj, saving });
    }
  }
  savings.sort((a, b) => b.saving - a.saving);

  // -----------------------------------------------------------------
  // Step 3: Merge Routes
  // -----------------------------------------------------------------
  const findRouteByLoc = (id) =>
    routes.find((r) => r.stops.some((s) => toId(s.locationId) === id && s.order !== 0 && s.order !== r.stops.length -1));

  for (const s of savings) {
    const rI = findRouteByLoc(toId(s.i._id));
    const rJ = findRouteByLoc(toId(s.j._id));
    if (!rI || !rJ || rI === rJ) continue;

    const iIsEnd = toId(rI.stops[rI.stops.length - 2].locationId) === toId(s.i._id);
    const jIsStart = toId(rJ.stops[1].locationId) === toId(s.j._id);
    if (!iIsEnd || !jIsStart) continue;

    const totalDemand = (rI.totalCapacity || 0) + (rJ.totalCapacity || 0);
    if (totalDemand > maxCapacity) continue;

    const mergedStops = [
      ...rI.stops.slice(0, -1),
      ...rJ.stops.slice(1),
    ].map((st, idx) => ({ ...st, order: idx }));

    const mergedRoute = {
      vehicle: undefined,
      vehicleName: 'Unassigned',
      stops: mergedStops,
      totalCapacity: totalDemand,
    };

    recomputeTimesAndDistance(mergedRoute, distances, useTimeWindows);

    // IMPROVEMENT: Only commit the merge if the new route is feasible.
    if (!mergedRoute.isViolated) {
        routes = routes.filter(r => r !== rI && r !== rJ);
        routes.push(mergedRoute);
    }
  }

  // -----------------------------------------------------------------
  // Step 4: Assign Vehicles
  // -----------------------------------------------------------------
  const vehiclePool = [];
  vehicles.forEach((v) => {
    const count = v.count || 1;
    for (let i = 0; i < count; i++) {
      vehiclePool.push({
        _id: v._id,
        name: v.name,
        capacity: v.capacity || 0,
        used: false,
      });
    }
  });
  
  // IMPROVEMENT: Sort routes by demand for more efficient vehicle packing.
  routes.sort((a, b) => b.totalCapacity - a.totalCapacity);

  routes.forEach((r) => {
    const v = vehiclePool.find((veh) => !veh.used && veh.capacity >= r.totalCapacity);
    if (v) {
      v.used = true;
      r.vehicle = v._id;
      r.vehicleName = v.name;
    } else {
      r.vehicle = null;
      r.vehicleName = "Unassigned - Insufficient Capacity";
    }
  });

  // -----------------------------------------------------------------
  // Step 5: Improve with Local Search
  // -----------------------------------------------------------------
  routes.forEach((r) => {
      if (r.stops.length > 3) { // Only run on routes with at least 2 customers
        improveRouteWithLocalSearch(r, distances, BASE_SPEED_KMH);
        // IMPROVEMENT: Recompute timings after stop order has changed.
        recomputeTimesAndDistance(r, distances, useTimeWindows);
      }
  });

  console.log("✅ Clarke-Wright with Time Windows completed.");
  // console.log(routes)
  return routes;
};

// =================================================================
// TIME + DISTANCE COMPUTATION (REFACTORED FOR CORRECTNESS)
// =================================================================
function recomputeTimesAndDistance(route, distances, useTimeWindows) {
  let totalDist = 0;
  route.isViolated = false; // Flag to track feasibility

  // Initialize depot times
  route.stops[0].arrivalTime = DEPOT_START_TIME_SECONDS;
  route.stops[0].departureTime = DEPOT_START_TIME_SECONDS;

  for (let i = 1; i < route.stops.length; i++) {
    const prevStop = route.stops[i-1];
    const currentStop = route.stops[i];
    
    const dist = distances[toId(prevStop.locationId)][toId(currentStop.locationId)];
    totalDist += dist;

    const travelTime = computeTravelTime(dist);
    let arrival = prevStop.departureTime + travelTime;
    let waitingTime = 0;

    if (useTimeWindows && currentStop.startTimeWindowSeconds != null) {
        const startTW = currentStop.startTimeWindowSeconds;
        const endTW = currentStop.endTimeWindowSeconds;

        if (arrival < startTW) {
            waitingTime = startTW - arrival;
            arrival = startTW;
        }
        if (arrival > endTW) {
            console.warn(`⚠️ Route violates window at ${currentStop.locationName}. Arrival: ${arrival.toFixed(0)}, End: ${endTW}`);
            route.isViolated = true;
        }
    }
    
    // No service time for the final return to depot
    const serviceTime = (i === route.stops.length - 1) ? 0 : (currentStop.serviceTime || 0);
    const departure = arrival + serviceTime;
    
    currentStop.arrivalTime = Math.round(arrival);
    currentStop.waitingTime = Math.round(waitingTime);
    currentStop.departureTime = Math.round(departure);
  }

  // Check final return to depot against depot's closing time
  const lastStop = route.stops[route.stops.length - 1];
  if (lastStop.arrivalTime > DEPOT_END_TIME_SECONDS) {
      console.warn(`⚠️ Route violates depot closing time.`);
      route.isViolated = true;
  }

  route.distance = totalDist;
  const totalSeconds = lastStop.arrivalTime - DEPOT_START_TIME_SECONDS;
  route.duration = Math.round(totalSeconds / 60);
}