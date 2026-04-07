const { calculateDistance } = require('../utils/optimizationUtils');
const { enhancedLocalSearch } = require('./localSearch');

// exports.enhancedClarkeWrightAlgorithm = (vehicles, locations, depot) => {
//     console.log("Running Enhanced Clarke-Wright Algorithm...");
//     // ... Paste the entire logic of the enhancedClarkeWrightAlgorithm here
//     return routes;
// };
// =================================================================
// MAIN: Enhanced Clarke-Wright Algorithm
// =================================================================
exports.enhancedClarkeWrightAlgorithm = (vehicles, locations, depot, options = {}) => {
  const useTimeWindows = options.useTimeWindows || false;
  const avgSpeedKmh = options.avgSpeedKmh || 40;

  console.log(`🚚 Running Enhanced Clarke-Wright (Speed: ${avgSpeedKmh}km/h)...`);

  const toId = (objId) => objId.toString();
  const depotId = toId(depot._id);

  // Constants
  const BASE_SERVICE_TIME_SECONDS = 3 * 60;
  const UNITS_PER_SECOND_OF_UNLOADING = 10 / 60;
  const TRAFFIC_FACTOR = 1.25;
  const DEPOT_START_TIME_SECONDS = 6 * 3600;

  // Build distance matrix (include depot)
  const distances = {};
  const allLocations = [depot, ...locations];

  allLocations.forEach((l1) => {
    const id1 = toId(l1._id);
    distances[id1] = {};
    allLocations.forEach((l2) => {
      const id2 = toId(l2._id);
      distances[id1][id2] = calculateDistance(
        l1.latitude, l1.longitude, l2.latitude, l2.longitude
      );
    });
  });

  const nonDepot = locations.filter((l) => toId(l._id) !== depotId);

  // Enhanced savings calculation
  const savings = [];
  for (let i = 0; i < nonDepot.length; i++) {
    for (let j = i + 1; j < nonDepot.length; j++) {
      const li = nonDepot[i];
      const lj = nonDepot[j];
      const idI = toId(li._id);
      const idJ = toId(lj._id);

      // Basic C-W Saving: d(D,i) + d(D,j) - d(i,j)
      const basicSaving = distances[depotId][idI] + distances[depotId][idJ] - distances[idI][idJ];

      // Enhanced factors
      const angleI = Math.atan2(li.latitude - depot.latitude, li.longitude - depot.longitude);
      const angleJ = Math.atan2(lj.latitude - depot.latitude, lj.longitude - depot.longitude);
      const angularDiff = Math.abs(angleI - angleJ);
      const angularBonus = Math.min(angularDiff, 2 * Math.PI - angularDiff) / Math.PI;

      const demandI = li.demand || 0;
      const demandJ = lj.demand || 0;
      const combinedDemand = demandI + demandJ;
      const maxVehicleCapacity = vehicles.length > 0 ? Math.max(...vehicles.map(v => v.capacity || 0)) : Infinity;
      const capacityCompatibility = combinedDemand <= maxVehicleCapacity ? 1 : Math.max(0.1, maxVehicleCapacity / combinedDemand);

      const distanceEfficiency = Math.max(0.8, 1 - (distances[idI][idJ] / 50));

      const enhancedSaving = basicSaving *
        (1 + angularBonus * 0.15) *
        capacityCompatibility *
        distanceEfficiency;

      savings.push({
        i: li, j: lj, saving: enhancedSaving
      });
    }
  }
  savings.sort((a, b) => b.saving - a.saving);

  // Initialize routes (single customer per route)
  const makeDepotStop = (order) => ({
    locationId: depot._id,
    locationName: depot.name,
    latitude: depot.latitude,
    longitude: depot.longitude,
    demand: 0,
    order,
    arrivalTime: DEPOT_START_TIME_SECONDS,
    serviceTime: 0,
    departureTime: DEPOT_START_TIME_SECONDS
  });

  const routes = nonDepot.map((loc) => {
    // Initial calculation for single route
    // Depot -> Loc -> Depot
    const distTo = distances[depotId][toId(loc._id)];
    const distFrom = distances[toId(loc._id)][depotId];

    // Arrival at Loc
    const travelTime1 = ((distTo / avgSpeedKmh) * 3600) * TRAFFIC_FACTOR;
    const arrival1 = DEPOT_START_TIME_SECONDS + travelTime1;

    // Service
    const demand = loc.demand || 0;
    const serviceTime = BASE_SERVICE_TIME_SECONDS + (demand / UNITS_PER_SECOND_OF_UNLOADING);

    // Time Window logic (simplified for initialization)
    let finalArrival = arrival1;
    let wait = 0;
    if (useTimeWindows && loc.startTimeWindowSeconds) {
      if (finalArrival < loc.startTimeWindowSeconds) {
        wait = loc.startTimeWindowSeconds - finalArrival;
        finalArrival = loc.startTimeWindowSeconds;
      }
    }
    const departure1 = finalArrival + serviceTime;

    // Return to Depot
    const travelTime2 = ((distFrom / avgSpeedKmh) * 3600) * TRAFFIC_FACTOR;
    const arrivalDepot = departure1 + travelTime2;

    const stops = [
      makeDepotStop(0),
      {
        locationId: loc._id,
        locationName: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        demand: loc.demand || 0,
        order: 1,
        arrivalTime: Math.round(finalArrival),
        serviceTime: Math.round(serviceTime + wait),
        departureTime: Math.round(departure1),
        startTimeWindowSeconds: loc.startTimeWindowSeconds,
        endTimeWindowSeconds: loc.endTimeWindowSeconds
      },
      {
        ...makeDepotStop(2),
        arrivalTime: Math.round(arrivalDepot),
        departureTime: Math.round(arrivalDepot)
      }
    ];

    return {
      vehicle: undefined,
      vehicleName: 'Unassigned',
      stops,
      distance: distTo + distFrom,
      duration: Math.round((arrivalDepot - DEPOT_START_TIME_SECONDS) / 60),
      totalCapacity: loc.demand || 0
    };
  });

  const maxCapacity = vehicles.length > 0 ? Math.max(...vehicles.map((v) => v.capacity || 0)) : 0;
  const findRouteIndexByLocation = (idStr) => {
    for (let r = 0; r < routes.length; r++) {
      if (routes[r].stops.some(s => toId(s.locationId) === idStr && s.order !== 0 && s.order !== routes[r].stops.length - 1)) {
        return r;
      }
    }
    return -1;
  };

  const recomputeRouteMetrics = (rt) => {
    let totalDist = 0;
    let currentTime = DEPOT_START_TIME_SECONDS;
    rt.stops[0].arrivalTime = currentTime;
    rt.stops[0].departureTime = currentTime;

    for (let k = 0; k < rt.stops.length - 1; k++) {
      const from = rt.stops[k];
      const to = rt.stops[k + 1];
      const fromId = toId(from.locationId);
      const toIdStr = toId(to.locationId);

      const dist = distances[fromId]?.[toIdStr] ?? calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
      totalDist += dist;

      const travelTime = ((dist / avgSpeedKmh) * 3600) * TRAFFIC_FACTOR;
      let arrival = currentTime + travelTime;

      let service = 0;
      let wait = 0;

      // Logic for customer stops (not depot)
      if (k + 1 < rt.stops.length - 1) { // 'to' is not the final depot
        const demand = to.demand || 0;
        service = BASE_SERVICE_TIME_SECONDS + (demand / UNITS_PER_SECOND_OF_UNLOADING);

        if (useTimeWindows && to.startTimeWindowSeconds != null) {
          if (arrival < to.startTimeWindowSeconds) {
            wait = to.startTimeWindowSeconds - arrival;
            arrival = to.startTimeWindowSeconds;
          }
        }
      }

      to.arrivalTime = Math.round(arrival);
      // Store raw service time + wait time if needed, or just service. 
      // Usually serviceTime field implies duration of stay.
      to.serviceTime = Math.round(service + wait);

      currentTime = arrival + service;
      to.departureTime = Math.round(currentTime);
    }

    rt.distance = totalDist;
    rt.duration = Math.round((currentTime - DEPOT_START_TIME_SECONDS) / 60);
  };

  // Merge Process
  for (const s of savings) {
    const idI = toId(s.i._id);
    const idJ = toId(s.j._id);

    const rIdxI = findRouteIndexByLocation(idI);
    const rIdxJ = findRouteIndexByLocation(idJ);

    if (rIdxI === -1 || rIdxJ === -1 || rIdxI === rIdxJ) continue;

    const r1 = routes[rIdxI];
    const r2 = routes[rIdxJ];

    // Check merge validity (i must be last of r1, j must be first of r2, simplified for interior logic)
    // Actually standard C-W checks if i is connected to depot in r1, j is connected to depot in r2.
    // Specifically: i is last customer in r1, j is first customer in r2.

    const iIsLast = toId(r1.stops[r1.stops.length - 2].locationId) === idI;
    const jIsFirst = toId(r2.stops[1].locationId) === idJ;
    // Also check reverse merge: j is last of r2, i is first of r1
    const jIsLast = toId(r2.stops[r2.stops.length - 2].locationId) === idJ;
    const iIsFirst = toId(r1.stops[1].locationId) === idI;

    let newStops = null;
    let keepR1 = false; // Flag to know which one keeps the new stops

    if (iIsLast && jIsFirst) {
      // Merge: r1 + r2 (excluding depots in between)
      // r1: D ... i D
      // r2: D j ... D
      // Result: D ... i j ... D
      newStops = [...r1.stops.slice(0, -1), ...r2.stops.slice(1)];
    } else if (jIsLast && iIsFirst) {
      // Merge: r2 + r1
      newStops = [...r2.stops.slice(0, -1), ...r1.stops.slice(1)];
    }

    if (!newStops) continue;

    const combinedDemand = (r1.totalCapacity || 0) + (r2.totalCapacity || 0);
    if (combinedDemand > maxCapacity) continue;

    // Fix orders
    newStops.forEach((st, idx) => st.order = idx);

    const mergedRoute = {
      vehicle: undefined,
      vehicleName: 'Unassigned',
      stops: newStops,
      totalCapacity: combinedDemand,
      distance: 0,
      duration: 0
    };

    recomputeRouteMetrics(mergedRoute);

    // Replace the two routes with merged one
    // Remove larger index first to avoid shifting problems
    const idx1 = Math.max(rIdxI, rIdxJ);
    const idx2 = Math.min(rIdxI, rIdxJ);
    routes.splice(idx1, 1);
    routes.splice(idx2, 1, mergedRoute);
  }

  // Assign Vehicles
  const vehicleSlots = [];
  vehicles.forEach((v) => {
    const count = v.count || 1;
    for (let i = 0; i < count; i++) {
      vehicleSlots.push({ ...v, capacity: v.capacity || 0, used: false, currentLoad: 0 });
    }
  });

  routes.sort((a, b) => (b.totalCapacity || 0) - (a.totalCapacity || 0));
  vehicleSlots.sort((a, b) => b.capacity - a.capacity);

  for (const route of routes) {
    const bestSlot = vehicleSlots.find(vs => !vs.used && vs.capacity >= (route.totalCapacity || 0));
    if (bestSlot) {
      route.vehicle = bestSlot._id;
      route.vehicleName = bestSlot.name;
      bestSlot.used = true;
    }
  }

  // Apply Local Search
  routes.forEach((route) => {
    // Only apply if enough stops
    if (route.stops.length > 3) {
      enhancedLocalSearch(route, distances, avgSpeedKmh);
      recomputeRouteMetrics(route);
    }
  });

  return routes;
}