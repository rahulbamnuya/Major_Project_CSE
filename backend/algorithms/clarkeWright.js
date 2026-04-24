const { calculateDistance, getDistanceMatrix } = require('../utils/optimizationUtils');
const { improveRouteWithLocalSearch } = require('./localSearch');

// =================================================================
// CONSTANTS
// =================================================================
const DEFAULT_SPEED_KMH = 40;
const TRAFFIC_FACTOR = 1.25;
const DEPOT_START_TIME_SECONDS = 6 * 3600; // 6:00 AM
const DEPOT_END_TIME_SECONDS = 22 * 3600; // 10:00 PM
const BASE_SERVICE_TIME_SECONDS = 3 * 60; // 3 minutes
const UNITS_PER_SECOND_OF_UNLOADING = 10 / 60; // 10 units per minute

const toId = (id) => id.toString();

// =================================================================
// HELPER FUNCTIONS
// =================================================================
const computeTravelTime = (distanceMeters, speedKmh) =>
  ((distanceMeters / (speedKmh * 1000)) * 3600) * TRAFFIC_FACTOR;

const formatTimeWindow = (start, end) => ({
  startTimeWindowSeconds: start != null ? start * 60 : DEPOT_START_TIME_SECONDS,
  endTimeWindowSeconds: end != null ? end * 60 : DEPOT_END_TIME_SECONDS,
  timeWindowStart: start != null ? start * 60 : DEPOT_START_TIME_SECONDS,
  timeWindowEnd: end != null ? end * 60 : DEPOT_END_TIME_SECONDS,
});

// =================================================================
// MAIN FUNCTION
// =================================================================
exports.clarkeWrightAlgorithmWithTimeWindows = async (vehicles, locations, depot, options = {}) => {
  const useTimeWindows = options.useTimeWindows || false;
  const avgSpeedKmh = options.avgSpeedKmh || DEFAULT_SPEED_KMH;

  console.log(`🚚 Running Clarke-Wright Algorithm (Time Windows: ${useTimeWindows}, Speed: ${avgSpeedKmh}km/h)...`);

  // Combine depot and locations to build a complete distance matrix.
  const allNodes = [depot, ...locations];
  const depotId = toId(depot._id);

  // -----------------------------------------------------------------
  // Build distance matrix (Try OSRM Road Data first, then Haversine)
  // -----------------------------------------------------------------
  const distances = await getDistanceMatrix(allNodes);

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
        road_type: loc.road_type || 'STANDARD',
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
    recomputeTimesAndDistance(route, distances, useTimeWindows, avgSpeedKmh);
    return route;
  });

  // IMPROVEMENT: NO FILTERING. We want to see all deliveries, even late ones.
  // routes = routes.filter(r => !r.isViolated);

  // -----------------------------------------------------------------
  // Step 2: Compute Savings
  // -----------------------------------------------------------------
  const savings = [];
  for (let i = 0; i < nonDepot.length; i++) {
    for (let j = i + 1; j < nonDepot.length; j++) {
      const l1 = nonDepot[i];
      const l2 = nonDepot[j];
      const id1 = toId(l1._id);
      const id2 = toId(l2._id);

      // --- ENHANCED SAVINGS LOGIC (Smarter grouping) ---
      const basicSaving = distances[depotId][id1] + distances[depotId][id2] - distances[id1][id2];

      // Angular factor: group locations in the same direction
      const angle1 = Math.atan2(l1.latitude - depot.latitude, l1.longitude - depot.longitude);
      const angle2 = Math.atan2(l2.latitude - depot.latitude, l2.longitude - depot.longitude);
      const angularDiff = Math.abs(angle1 - angle2);
      const angularBonus = Math.min(angularDiff, 2 * Math.PI - angularDiff) / Math.PI;

      // Capacity Factor: prioritize merges that fill a truck better
      const combinedDemand = (l1.demand || 0) + (l2.demand || 0);
      const maxVehicleCap = vehicles.length > 0 ? Math.max(...vehicles.map(v => v.capacity || 0)) : 6000;
      const capBonus = combinedDemand <= maxVehicleCap ? 1 : Math.max(0.1, maxVehicleCap / combinedDemand);

      // Final enhanced value
      const sVal = basicSaving * (1 + (1 - angularBonus) * 0.15) * capBonus;

      savings.push({
        i: l1,
        j: l2,
        saving: sVal
      });
    }
  }
  savings.sort((a, b) => b.saving - a.saving);

  // -----------------------------------------------------------------
  // Step 3: Merge Routes (WITH INFRASTRUCTURE CAPACITY CHECKS)
  // -----------------------------------------------------------------

  // Calculate max possible capacity for each infrastructure tier
  const getVehType = (v) => (v.vehicle_type || '').toUpperCase();
  const maxCap = {
    NARROW: Math.max(0, ...vehicles.filter(v => getVehType(v) === 'SMALL').map(v => v.capacity || 0)),
    STANDARD: Math.max(0, ...vehicles.filter(v => ['SMALL', 'MEDIUM'].includes(getVehType(v))).map(v => v.capacity || 0)),
    WIDE: Math.max(0, ...vehicles.map(v => v.capacity || 0))
  };

  const findRouteByLoc = (id) =>
    routes.find((r) => r.stops.some((s) => toId(s.locationId) === id && s.order !== 0 && s.order !== r.stops.length - 1));

  for (const s of savings) {
    const rI = findRouteByLoc(toId(s.i._id));
    const rJ = findRouteByLoc(toId(s.j._id));
    if (!rI || !rJ || rI === rJ) continue;

    const iIsEnd = toId(rI.stops[rI.stops.length - 2].locationId) === toId(s.i._id);
    const jIsStart = toId(rJ.stops[1].locationId) === toId(s.j._id);
    if (!iIsEnd || !jIsStart) continue;

    // Infrastructure Awareness: What is the strictest road in the combined route?
    const combinedStops = [...rI.stops.slice(0, -1), ...rJ.stops.slice(1)];
    let combinedStrictest = 'WIDE';
    combinedStops.forEach(stop => {
      const loc = locations.find(l => toId(l._id) === toId(stop.locationId));
      const rt = (loc?.road_type || 'STANDARD').toUpperCase();
      if (rt === 'NARROW') combinedStrictest = 'NARROW';
      else if (rt === 'STANDARD' && combinedStrictest !== 'NARROW') combinedStrictest = 'STANDARD';
    });

    const combinedDemand = rI.totalCapacity + rJ.totalCapacity;
    const allowedMaxCap = maxCap[combinedStrictest];

    // CRITICAL: Reject merge if demand exceeds the largest COMPATIBLE vehicle
    if (combinedDemand > allowedMaxCap) {
      continue;
    }

    // Merge is valid
    const mergedRoute = {
      stops: combinedStops.map((stop, idx) => ({ ...stop, order: idx })),
      totalCapacity: combinedDemand,
      totalDistance: rI.totalDistance + rJ.totalDistance + distances[toId(s.i._id)][toId(s.j._id)] - distances[depotId][toId(s.i._id)] - distances[depotId][toId(s.j._id)],
    };

    recomputeTimesAndDistance(mergedRoute, distances, useTimeWindows, avgSpeedKmh);

    // Reverted: Allow all merges to maintain high fulfillment. 
    // Lateness will be shown in the UI but won't block the route creation.
    if (true || !mergedRoute.isViolated) {
      routes = routes.filter(r => r !== rI && r !== rJ);
      routes.push(mergedRoute);
    }
  }

  // -----------------------------------------------------------------
  // Step 4: Final Route Formatting
  // -----------------------------------------------------------------
  // Note: Vehicle assignment and multi-trip staggering are handled by the 
  // global dispatcher in optimizationUtils.js to ensure consistency across algorithms.
  routes.forEach((r, idx) => {
    r.vehicle = null; // Let the global dispatcher decide
    r.vehicleName = 'Unassigned';
  });

  // -----------------------------------------------------------------
  // Step 5: Improve with Local Search
  // -----------------------------------------------------------------
  routes.forEach((r) => {
    if (r.stops.length > 3) { // Only run on routes with at least 2 customers
      improveRouteWithLocalSearch(r, distances, avgSpeedKmh);
      // IMPROVEMENT: Recompute timings after stop order has changed.
      recomputeTimesAndDistance(r, distances, useTimeWindows, avgSpeedKmh);
    }
  });

  console.log("✅ Clarke-Wright with Time Windows completed.");
  // console.log(routes)
  return routes;
};

// =================================================================
// TIME + DISTANCE COMPUTATION (REFACTORED FOR CORRECTNESS)
// =================================================================
function recomputeTimesAndDistance(route, distances, useTimeWindows, speedKmh) {
  let totalDist = 0;
  route.isViolated = false; 
  route.timeViolationCount = 0;
  route.timeWindowApplied = useTimeWindows;

  // Initialize depot times
  route.stops[0].arrivalTime = DEPOT_START_TIME_SECONDS;
  route.stops[0].departureTime = DEPOT_START_TIME_SECONDS;

  for (let i = 1; i < route.stops.length; i++) {
    const prevStop = route.stops[i - 1];
    const currentStop = route.stops[i];

    const dist = distances[toId(prevStop.locationId)][toId(currentStop.locationId)];
    totalDist += dist;

    const travelTime = computeTravelTime(dist, speedKmh);
    let arrival = prevStop.departureTime + travelTime;
    let waitingTime = 0;

    const startTW = currentStop.startTimeWindowSeconds;
    const endTW = currentStop.endTimeWindowSeconds;
    
    // Always provide goalTime for UI even if windows not "applied" for logic
    currentStop.goalTime = endTW;

    if (useTimeWindows && startTW != null) {
      if (arrival < startTW) {
        waitingTime = startTW - arrival;
        arrival = startTW;
      }
      if (arrival > endTW) {
        console.warn(`⚠️ Route violates window at ${currentStop.locationName}. Arrival: ${arrival.toFixed(0)}, End: ${endTW}`);
        route.isViolated = true;
        route.timeViolationCount++;
        currentStop.isLate = true;
      }
    }

    // No service time for the final return to depot
    const serviceTime = (i === route.stops.length - 1) ? 0 : (currentStop.serviceTime || 0);
    const departure = arrival + serviceTime;

    currentStop.arrivalTime = Math.round(arrival);
    currentStop.waitingTime = Math.round(waitingTime);
    currentStop.departureTime = Math.round(departure);

    // Ensure the frontend has access to the target windows
    currentStop.timeWindowStart = startTW;
    currentStop.timeWindowEnd = endTW;
  }

  // Check final return to depot against depot's closing time
  const lastStop = route.stops[route.stops.length - 1];
  if (lastStop.arrivalTime > DEPOT_END_TIME_SECONDS) {
    console.warn(`⚠️ Route violates depot closing time.`);
    route.isViolated = true;
    route.timeViolationCount++;
    lastStop.isLate = true;
  }

  route.distance = totalDist;
  const totalSeconds = lastStop.arrivalTime - DEPOT_START_TIME_SECONDS;
  route.duration = Math.round(totalSeconds / 60);
}