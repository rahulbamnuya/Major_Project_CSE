const { calculateDistance, getDistanceMatrix } = require('../utils/optimizationUtils');
const { enhancedLocalSearch } = require('./localSearch');

const formatTimeWindow = (start, end) => ({
  startTimeWindowSeconds: start != null ? start * 60 : 6 * 3600,
  endTimeWindowSeconds: end != null ? end * 60 : 22 * 3600,
  timeWindowStart: start != null ? start * 60 : 6 * 3600,
  timeWindowEnd: end != null ? end * 60 : 22 * 3600,
});

/**
 * MAIN: Enhanced Clarke-Wright Algorithm
 */
exports.enhancedClarkeWrightAlgorithm = async (vehicles, locations, depot, options = {}) => {
  const useTimeWindows = options.useTimeWindows || false;
  const avgSpeedKmh = options.avgSpeedKmh || 40;

  console.log(`🚚 Running Enhanced Clarke-Wright (Speed: ${avgSpeedKmh}km/h)...`);

  const toId = (objId) => objId.toString();
  const depotId = toId(depot._id);

  const TRAFFIC_FACTOR = options.trafficFactor !== undefined ? options.trafficFactor : 1.25;
  const DEPOT_START_TIME_SECONDS = options.depotStartTime !== undefined ? options.depotStartTime : 6 * 3600;
  const DEPOT_END_TIME_SECONDS = options.depotEndTime !== undefined ? options.depotEndTime : 22 * 3600;
  const BASE_SERVICE_TIME_SECONDS = options.baseServiceTime !== undefined ? options.baseServiceTime : 3 * 60;
  const UNITS_PER_SECOND_OF_UNLOADING = options.unitsPerSecond !== undefined ? options.unitsPerSecond : 10 / 60;

  // Build distance matrix (include depot)
  const allLocations = [depot, ...locations];
  const distances = await getDistanceMatrix(allLocations);

  const nonDepot = locations.filter((l) => toId(l._id) !== depotId);

  // Dynamic Infrastructure Thresholds (match clarkeWright.js)
  const getVehType = (v) => (v.vehicle_type || '').toUpperCase();
  const maxCap = {
    NARROW: Math.max(0, ...vehicles.filter(v => getVehType(v) === 'SMALL').map(v => v.capacity || 0)),
    STANDARD: Math.max(0, ...vehicles.filter(v => ['SMALL', 'MEDIUM'].includes(getVehType(v))).map(v => v.capacity || 0)),
    WIDE: Math.max(0, ...vehicles.map(v => v.capacity || 0))
  };

  // Enhanced savings calculation
  const savings = [];
  for (let i = 0; i < nonDepot.length; i++) {
    for (let j = i + 1; j < nonDepot.length; j++) {
      const li = nonDepot[i];
      const lj = nonDepot[j];
      const idI = toId(li._id);
      const idJ = toId(lj._id);

      const getDist = (fId, tId, fLoc, tLoc) => {
          return distances.distances[fId]?.[tId] ?? calculateDistance(fLoc.latitude, fLoc.longitude, tLoc.latitude, tLoc.longitude);
      };

    // --- ENHANCED SAVINGS LOGIC (Time-Aware) ---
    const locTimeWindowI = formatTimeWindow(
        li.timeWindowStart || (li.timeWindow ? li.timeWindow[0] : null),
        li.timeWindowEnd || (li.timeWindow ? li.timeWindow[1] : null)
    );
    const locTimeWindowJ = formatTimeWindow(
        lj.timeWindowStart || (lj.timeWindow ? lj.timeWindow[0] : null),
        lj.timeWindowEnd || (lj.timeWindow ? lj.timeWindow[1] : null)
    );

    const distDI = getDist(depotId, idI, depot, li);
    const distDJ = getDist(depotId, idJ, depot, lj);
    const distIJ = getDist(idI, idJ, li, lj);
    
    const basicSaving = distDI + distDJ - distIJ;

    // Time Penalty: Don't merge if windows are very far apart
    let timePenalty = 1.0;
    if (useTimeWindows) {
        const midI = (locTimeWindowI.startTimeWindowSeconds + locTimeWindowI.endTimeWindowSeconds) / 2;
        const midJ = (locTimeWindowJ.startTimeWindowSeconds + locTimeWindowJ.endTimeWindowSeconds) / 2;
        const timeDiff = Math.abs(midI - midJ) / 3600; // in hours
        timePenalty = Math.max(0.5, 1.0 - (timeDiff / 12)); // Lose up to 50% saving if windows are 12 hours apart
    }

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

    const enhancedSaving = basicSaving *
      (1 + (1 - angularBonus) * 0.15) *
      capacityCompatibility *
      timePenalty;

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
  const locTimeWindow = formatTimeWindow(
      loc.timeWindowStart || (loc.timeWindow ? loc.timeWindow[0] : null),
      loc.timeWindowEnd || (loc.timeWindow ? loc.timeWindow[1] : null)
  );

  const distTo = distances.distances[depotId][toId(loc._id)];
  const distFrom = distances.distances[toId(loc._id)][depotId];
  const travelTime1 = distances.durations[depotId]?.[toId(loc._id)] ?? (((distTo / avgSpeedKmh) * 3600) * TRAFFIC_FACTOR);
  
  let arrival1 = DEPOT_START_TIME_SECONDS + travelTime1;
  let wait = 0;
  if (useTimeWindows && locTimeWindow.startTimeWindowSeconds) {
    if (arrival1 < locTimeWindow.startTimeWindowSeconds) {
      wait = locTimeWindow.startTimeWindowSeconds - arrival1;
      arrival1 = locTimeWindow.startTimeWindowSeconds;
    }
  }

  const demand = loc.demandWeight || loc.demand || 0;
  const serviceTime = BASE_SERVICE_TIME_SECONDS + (demand / UNITS_PER_SECOND_OF_UNLOADING);
  const departure1 = arrival1 + serviceTime;
  const travelTime2 = distances.durations[toId(loc._id)]?.[depotId] ?? (((distFrom / avgSpeedKmh) * 3600) * TRAFFIC_FACTOR);
  const arrivalDepot = departure1 + travelTime2;

  const stops = [
    {
      ...makeDepotStop(0),
      arrivalTime: DEPOT_START_TIME_SECONDS,
      departureTime: DEPOT_START_TIME_SECONDS
    },
    {
      locationId: loc._id,
      locationName: loc.name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      demand: loc.demandWeight || loc.demand || 0,
      order: 1,
      arrivalTime: Math.round(arrival1),
      serviceTime: Math.round(serviceTime + wait),
      departureTime: Math.round(departure1),
      ...locTimeWindow
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
    rt.isViolated = false;
    rt.timeViolationCount = 0;
    rt.timeWindowApplied = useTimeWindows;
    rt.stops[0].arrivalTime = currentTime;
    rt.stops[0].departureTime = currentTime;

    for (let k = 0; k < rt.stops.length - 1; k++) {
      const from = rt.stops[k];
      const to = rt.stops[k + 1];
      const fromId = toId(from.locationId);
      const toIdStr = toId(to.locationId);

      // Use matrix strictly with robust fallback (preventing 0-dist bugs)
      const dist = distances.distances[fromId]?.[toIdStr] ?? calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
      totalDist += dist;

      const travelTime = distances.durations[fromId]?.[toIdStr] ?? (((dist / avgSpeedKmh) * 3600) * TRAFFIC_FACTOR);
      let arrival = currentTime + travelTime;

      let service = 0;
      let wait = 0;

      // Logic for customer stops (not depot)
      if (k + 1 < rt.stops.length - 1) { // 'to' is not the final depot
        const demand = to.demandWeight || to.demand || 0;
        const locObj = locations.find(l => toId(l._id) === toIdStr);
        service = (locObj && locObj.serviceTimeSeconds != null) 
          ? locObj.serviceTimeSeconds 
          : BASE_SERVICE_TIME_SECONDS + (demand / UNITS_PER_SECOND_OF_UNLOADING);

        const twStart = to.startTimeWindowSeconds;
        const twEnd = to.endTimeWindowSeconds;
        
        // Always provide goalTime for UI
        to.goalTime = twEnd;

        if (useTimeWindows && twStart != null) {
          if (arrival < twStart) {
            wait = twStart - arrival;
            arrival = twStart;
          }
          if (arrival > twEnd) {
            rt.isViolated = true;
            rt.timeViolationCount++;
            to.isLate = true;
          }
        }
      }

      to.arrivalTime = Math.round(arrival);
      to.waitingTime = Math.round(wait);
      to.serviceTime = Math.round(service); // Separate service from wait
      currentTime = arrival + service;
      to.departureTime = Math.round(currentTime);
    }

    // Check final return to depot
    if (rt.stops[rt.stops.length - 1].arrivalTime > DEPOT_END_TIME_SECONDS) {
      rt.isViolated = true;
      rt.timeViolationCount++;
      rt.stops[rt.stops.length - 1].isLate = true;
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

    // 🛡️ INFRASTRUCTURE AWARENESS: Don't merge if it violates road capacities
    const getStrictest = (rt) => {
      let strict = 'WIDE';
      rt.stops.forEach(s => {
        const type = (s.road_type || 'STANDARD').toUpperCase();
        if (type === 'NARROW') strict = 'NARROW';
        else if (type === 'STANDARD' && strict !== 'NARROW') strict = 'STANDARD';
      });
      return strict;
    };

    const s1 = getStrictest(r1);
    const s2 = getStrictest(r2);
    const overall = (s1 === 'NARROW' || s2 === 'NARROW') ? 'NARROW' : ((s1 === 'STANDARD' || s2 === 'STANDARD') ? 'STANDARD' : 'WIDE');
    const allowedMaxCap = options.isSolomonBenchmark ? Math.max(...vehicles.map(v => v.capacity || 0)) : (maxCap[overall] || 0);

    if (combinedDemand > allowedMaxCap) continue;

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

    // If time windows are enabled, only accept the merge if it doesn't cause a violation.
    if (!useTimeWindows || !mergedRoute.isViolated) {
      const idx1 = Math.max(rIdxI, rIdxJ);
      const idx2 = Math.min(rIdxI, rIdxJ);
      routes.splice(idx1, 1);
      routes.splice(idx2, 1, mergedRoute);
    }
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