// /algorithms/localSearch.js
const { calculateDistance } = require('../utils/optimizationUtils');

const TRAFFIC_FACTOR = 1.25;
const BASE_SERVICE_TIME_SECONDS = 3 * 60;
const UNITS_PER_SECOND_OF_UNLOADING = 10 / 60;
const DEPOT_START_TIME_SECONDS = 6 * 3600;
const DEPOT_END_TIME_SECONDS = 22 * 3600;

const toId = (x) => x.locationId.toString();

/**
 * Checks if a sequence of stops is feasible under time windows.
 */
function isSequenceFeasible(seq, distances, speedKmh, useTimeWindows) {
  if (!useTimeWindows) return true;
  
  let currentTime = DEPOT_START_TIME_SECONDS;
  for (let i = 0; i < seq.length - 1; i++) {
    const from = seq[i];
    const to = seq[i+1];
    const fromId = toId(from);
    const toIdStr = toId(to);

    const dist = distances.distances[fromId]?.[toIdStr] ?? calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
    const travelTime = distances.durations[fromId]?.[toIdStr] ?? (((dist / speedKmh) * 3600) * TRAFFIC_FACTOR);
    let arrival = currentTime + travelTime;

    if (i + 1 < seq.length - 1) { // Customer stop
      const twStart = to.startTimeWindowSeconds !== undefined ? to.startTimeWindowSeconds : to.timeWindowStart;
      const twEnd = to.endTimeWindowSeconds !== undefined ? to.endTimeWindowSeconds : to.timeWindowEnd;

      if (twStart !== null && twStart !== undefined && arrival < twStart) arrival = twStart;
      if (twEnd !== null && twEnd !== undefined && arrival > twEnd) return false; // Infeasible!

      const service = BASE_SERVICE_TIME_SECONDS + ((to.demand || 0) / UNITS_PER_SECOND_OF_UNLOADING);
      currentTime = arrival + service;
    } else { // Final depot
      if (arrival > DEPOT_END_TIME_SECONDS) return false;
    }
  }
  return true;
}

const calcDist = (seq, distances) => {
  let d = 0;
  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i];
    const b = seq[i + 1];
    const ai = toId(a);
    const bi = toId(b);
    const dist = distances.distances[ai]?.[bi];
    d += (dist !== undefined && dist !== null) ? dist : calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude);
  }
  return d;
};

exports.improveRouteWithLocalSearch = (route, distances, speedKmh) => {
  if (!route.stops || route.stops.length < 4) return;
  const useTimeWindows = route.timeWindowApplied || false;

  const first = route.stops[0];
  const last = route.stops[route.stops.length - 1];
  let seq = [first, ...route.stops.slice(1, -1), last];

  // 2-opt improvement
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < seq.length - 2; i++) {
      for (let k = i + 1; k < seq.length - 1; k++) {
        const newSeq = [...seq.slice(0, i), ...seq.slice(i, k + 1).reverse(), ...seq.slice(k + 1)];
        if (calcDist(newSeq, distances) + 1e-9 < calcDist(seq, distances)) {
          // Check feasibility before accepting
          if (isSequenceFeasible(newSeq, distances, speedKmh, useTimeWindows)) {
            seq = newSeq;
            improved = true;
          }
        }
      }
    }
  }

  route.stops = seq.map((s, idx) => ({ ...s, order: idx }));
  route.distance = calcDist(seq, distances);
};

exports.enhancedLocalSearch = (route, distances, speedKmh) => {
  if (!route.stops || route.stops.length < 4) return;
  const useTimeWindows = route.timeWindowApplied || false;

  const first = route.stops[0];
  const last = route.stops[route.stops.length - 1];
  let seq = [first, ...route.stops.slice(1, -1), last];

  // 2-opt
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < seq.length - 2; i++) {
      for (let k = i + 1; k < seq.length - 1; k++) {
        const newSeq = [...seq.slice(0, i), ...seq.slice(i, k + 1).reverse(), ...seq.slice(k + 1)];
        if (calcDist(newSeq, distances) + 1e-9 < calcDist(seq, distances)) {
          if (isSequenceFeasible(newSeq, distances, speedKmh, useTimeWindows)) {
            seq = newSeq;
            improved = true;
          }
        }
      }
    }
  }

  // Or-opt
  for (let length = 1; length <= 3; length++) {
    for (let i = 1; i < seq.length - length - 1; i++) {
      const segment = seq.slice(i, i + length);
      const remaining = [...seq.slice(0, i), ...seq.slice(i + length)];

      for (let j = 1; j < remaining.length; j++) {
        const newSeq = [...remaining.slice(0, j), ...segment, ...remaining.slice(j)];
        if (calcDist(newSeq, distances) + 1e-9 < calcDist(seq, distances)) {
          if (isSequenceFeasible(newSeq, distances, speedKmh, useTimeWindows)) {
            seq = newSeq;
          }
        }
      }
    }
  }

  route.stops = seq.map((s, idx) => ({ ...s, order: idx }));
  route.distance = calcDist(seq, distances);
};