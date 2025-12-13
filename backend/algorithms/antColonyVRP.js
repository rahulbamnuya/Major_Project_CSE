// /algorithms/antColonyVRP.js
const { calculateDistance } = require('../utils/optimizationUtils');

// --- CONFIGURATION CONSTANTS (NOW IN SECONDS) ---
const BASE_SERVICE_TIME_SECONDS = 3 * 60; // 3 minutes
const UNITS_PER_SECOND_OF_UNLOADING = 10 / 60; // 10 units per minute
const AVERAGE_SPEED_KMH = 40;
const TRAFFIC_FACTOR = 1.25;
const DEPOT_START_TIME_SECONDS = 360 * 60; // 6:00 AM (360 * 60 = 21600)
const DEPOT_END_TIME_SECONDS = 1080 * 60;  // 6:00 PM (1080 * 60 = 64800)
const MAX_TIME_WINDOW_SECONDS = 24 * 3600; // 24 hours for "always open" fallback

// Helper to stringify ids
const toId = (objId) => objId && objId.toString();

// --- Construct solution for a single ant (robust) ---
function constructSolutionForAnt(vehicles, locations, depot, distances, pheromones, alpha, beta, options = {}) {
    const useTimeWindows = options.useTimeWindows || false;

    const depotId = toId(depot._id);
    // Build set of visitable ids (ensure depot is included if not in locations)
    const allLocationIds = new Set(locations.map(l => toId(l._id)));
    allLocationIds.add(depotId);

    // unvisited contains only customer ids (exclude depot)
    const unvisited = new Set(locations.filter(l => toId(l._id) !== depotId).map(l => toId(l._id)));
    const routes = [];

    // Expand vehicle slots (respect count)
    const vehicleSlots = [];
    vehicles.forEach((v) => {
        const vehicleData = typeof v.toObject === 'function' ? v.toObject() : v;
        const count = vehicleData.count || 1;
        for (let i = 0; i < count; i++) {
            vehicleSlots.push({ ...vehicleData, uniqueId: `${vehicleData._id}_${i}` });
        }
    });

    // For each vehicle slot, build a route
    for (const vehicle of vehicleSlots) {
        if (unvisited.size === 0) break;

        const route = {
            vehicle: vehicle._id,
            vehicleName: vehicle.name,
            stops: [],
            totalCapacity: 0,
            distance: 0,
            duration: 0,
            routeGeometry: []
        };

        let currentCapacity = 0;
        let currentLocation = depot;
        let currentTime = DEPOT_START_TIME_SECONDS;

        // Start at depot
        route.stops.push({
            locationId: depot._id,
            locationName: depot.name,
            latitude: depot.latitude,
            longitude: depot.longitude,
            demand: 0,
            order: 0,
            arrivalTime: Math.round(currentTime),
            serviceTime: 0,
            departureTime: Math.round(currentTime)
        });
        route.routeGeometry.push([depot.latitude, depot.longitude]);

        while (unvisited.size > 0) {
            const nextLocation = chooseNextLocation(
                currentLocation,
                unvisited,
                locations,
                vehicle.capacity,
                currentCapacity,
                distances,
                pheromones,
                alpha,
                beta,
                currentTime,
                depotId,
                useTimeWindows
            );

            if (!nextLocation) break; // no feasible candidate

            // safe lookups for distance: fallback to calculateDistance if matrix missing
            const distEntryFrom = distances[toId(currentLocation._id)];
            const distanceToNext = (distEntryFrom && distEntryFrom[toId(nextLocation._id)]) ??
                calculateDistance(currentLocation.latitude, currentLocation.longitude, nextLocation.latitude, nextLocation.longitude);

            const travelTime = ((distanceToNext / AVERAGE_SPEED_KMH) * 3600) * TRAFFIC_FACTOR;
            const arrivalTime = currentTime + travelTime;

            const demand = nextLocation.demand || 0;
            const demandBasedSeconds = demand / UNITS_PER_SECOND_OF_UNLOADING;
            const serviceTimeRaw = BASE_SERVICE_TIME_SECONDS + demandBasedSeconds;

            let waitTime = 0;
            let serviceStartTime = arrivalTime;
            let serviceTimeTotal = serviceTimeRaw;

            if (useTimeWindows) {
                const locationStartTime = (typeof nextLocation.startTimeWindowSeconds === 'number') ? nextLocation.startTimeWindowSeconds : 0;
                const locationEndTime = (typeof nextLocation.endTimeWindowSeconds === 'number') ? nextLocation.endTimeWindowSeconds : MAX_TIME_WINDOW_SECONDS;
                // if arrival is after window end -> skip / mark infeasible (we mark but still place)
                if (arrivalTime > locationEndTime) {
                    // mark infeasible by setting flag on route; still push the stop with times
                    route.infeasible = true;
                } else {
                    waitTime = Math.max(0, locationStartTime - arrivalTime);
                    serviceStartTime = arrivalTime + waitTime;
                    if (serviceStartTime + serviceTimeRaw > locationEndTime) {
                        route.infeasible = true;
                    }
                    serviceTimeTotal = serviceTimeRaw + waitTime;
                }
            }

            currentCapacity += demand;
            route.stops.push({
                locationId: nextLocation._id,
                locationName: nextLocation.name,
                latitude: nextLocation.latitude,
                longitude: nextLocation.longitude,
                demand: demand,
                order: route.stops.length,
                arrivalTime: Math.round(arrivalTime),
                serviceTime: Math.round(serviceTimeTotal),
                departureTime: Math.round(serviceStartTime + serviceTimeRaw)
            });
            route.routeGeometry.push([nextLocation.latitude, nextLocation.longitude]);

            // update currentTime to departure
            currentTime = serviceStartTime + serviceTimeRaw;

            unvisited.delete(toId(nextLocation._id));
            currentLocation = nextLocation;
        }

        // Return to depot
        const lastId = toId(currentLocation._id);
        const distFromLast = distances[lastId] && distances[lastId][depotId];
        const distanceToDepot = distFromLast ?? calculateDistance(currentLocation.latitude, currentLocation.longitude, depot.latitude, depot.longitude);
        const travelTimeToDepot = ((distanceToDepot / AVERAGE_SPEED_KMH) * 3600) * TRAFFIC_FACTOR;
        currentTime += travelTimeToDepot;

        route.stops.push({
            locationId: depot._id,
            locationName: depot.name,
            latitude: depot.latitude,
            longitude: depot.longitude,
            demand: 0,
            order: route.stops.length,
            arrivalTime: Math.round(currentTime),
            serviceTime: 0,
            departureTime: Math.round(currentTime)
        });
        route.routeGeometry.push([depot.latitude, depot.longitude]);

        if (route.stops.length > 2) {
            // compute totalDist defensively
            let totalDist = 0;
            for (let i = 0; i < route.stops.length - 1; i++) {
                const fromId = toId(route.stops[i].locationId);
                const toIdStr = toId(route.stops[i + 1].locationId);
                const d = (distances[fromId] && distances[fromId][toIdStr]) ??
                    calculateDistance(route.stops[i].latitude, route.stops[i].longitude, route.stops[i + 1].latitude, route.stops[i + 1].longitude);
                totalDist += d || 0;
            }
            route.distance = totalDist;
            route.duration = Math.round((currentTime - DEPOT_START_TIME_SECONDS) / 60);
            route.totalCapacity = currentCapacity;
            routes.push(route);
        }
    }
    return routes;
}

/**
 * chooseNextLocation: probabilistic choice, skips candidates when required matrix/pheromone entries are missing.
 */
function chooseNextLocation(
    current,
    unvisited,
    allLocations,
    vehicleCapacity,
    currentLoad,
    distances,
    pheromones,
    alpha,
    beta,
    currentTime,
    depotId,
    useTimeWindows
) {
    const currentId = toId(current._id);
    const locationMap = new Map(allLocations.map(l => [toId(l._id), l]));

    const choices = [];
    let totalProbability = 0;

    for (const locationId of unvisited) {
        const candidate = locationMap.get(locationId);
        if (!candidate) continue;
        const candidateId = toId(candidate._id);

        // capacity constraint
        if ((currentLoad + (candidate.demand || 0)) > vehicleCapacity) continue;

        // guard: distances must exist for current->candidate and candidate->depot, or compute fallback
        const distCurToCand = (distances[currentId] && distances[currentId][candidateId]) ??
            calculateDistance(current.latitude, current.longitude, candidate.latitude, candidate.longitude);

        const distCandToDepot = (distances[candidateId] && distances[candidateId][depotId]) ??
            calculateDistance(candidate.latitude, candidate.longitude, /*depot will be looked up by caller*/ candidate.latitude, candidate.longitude); // fallback: doesn't matter for check below, we'll compute properly later if used

        // If for some reason distCurToCand is falsy, skip candidate
        if (distCurToCand == null || Number.isNaN(distCurToCand)) continue;

        // compute arrival and service times
        const travelTimeToCandidate = ((distCurToCand / AVERAGE_SPEED_KMH) * 3600) * TRAFFIC_FACTOR;
        const arrivalAtCandidate = currentTime + travelTimeToCandidate;

        const serviceTimeRaw = BASE_SERVICE_TIME_SECONDS + ((candidate.demand || 0) / UNITS_PER_SECOND_OF_UNLOADING);
        let serviceStart = arrivalAtCandidate;
        let departureFromCandidate = arrivalAtCandidate + serviceTimeRaw;

        if (useTimeWindows) {
            const candidateStartTime = (typeof candidate.startTimeWindowSeconds === 'number') ? candidate.startTimeWindowSeconds : 0;
            const candidateEndTime = (typeof candidate.endTimeWindowSeconds === 'number') ? candidate.endTimeWindowSeconds : DEPOT_END_TIME_SECONDS;

            // hard constraint: if arrival after end -> skip
            if (arrivalAtCandidate > candidateEndTime) continue;

            serviceStart = Math.max(arrivalAtCandidate, candidateStartTime);
            departureFromCandidate = serviceStart + serviceTimeRaw;

            // if service would finish after end -> mark infeasible, skip
            if (departureFromCandidate > candidateEndTime) continue;
        }

        // check return-to-depot feasibility: compute correct travel time to depot
        const distCandidateToDepot = (distances[candidateId] && distances[candidateId][depotId]) ??
            calculateDistance(candidate.latitude, candidate.longitude, /* assume depot coords unknown here; caller usually had them */ candidate.latitude, candidate.longitude);
        const travelTimeToDepot = ((distCandidateToDepot / AVERAGE_SPEED_KMH) * 3600) * TRAFFIC_FACTOR;
        const finalArrivalDepot = departureFromCandidate + travelTimeToDepot;

        if (finalArrivalDepot > DEPOT_END_TIME_SECONDS) {
            // can't return in time, skip candidate
            continue;
        }

        // pheromone & heuristic (guard pheromone existence: default to 1)
        const pher = (pheromones[currentId] && pheromones[currentId][candidateId]) ?? 1;
        const heuristic = distCurToCand > 0 ? 1 / distCurToCand : 1;

        const prob = Math.pow(pher, alpha) * Math.pow(heuristic, beta);
        choices.push({ candidate, prob });
        totalProbability += prob;
    }

    if (choices.length === 0) return null;

    // roulette wheel
    const r = Math.random() * totalProbability;
    let cum = 0;
    for (const c of choices) {
        cum += c.prob;
        if (r <= cum) return c.candidate;
    }
    return choices[choices.length - 1].candidate;
}


// --- Main exported ACO ---
exports.antColonyOptimizationVRP = (vehicles, locations, depot, options = {}) => {
    console.log("Running Ant Colony Optimization...");
    // Build distances matrix and ensure depot is included
    const distances = {};
    // include depot as well: create an array "allPlaces" = locations + depot (if not present)
    const depotId = toId(depot._id);
    const locMap = new Map(locations.map(l => [toId(l._id), l]));
    if (!locMap.has(depotId)) {
        // for distance building, we will treat depot separately (but include its id)
        // later calculateDistance uses coords directly so it's safe
    }

    // Add all locations (and depot) to distances
    const allPlaces = [...locations];
    if (!locations.some(l => toId(l._id) === depotId)) {
        allPlaces.push(depot);
    }

    allPlaces.forEach(l1 => {
        const id1 = toId(l1._id);
        distances[id1] = {};
        allPlaces.forEach(l2 => {
            const id2 = toId(l2._id);
            distances[id1][id2] = calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
        });
    });

    // ACO params
    const numAnts = 20;
    const numIterations = 100;
    const alpha = 1.0;
    const beta = 2.0;
    const rho = 0.1;
    const Q = 100;

    // initialize pheromones - ensure entries for all pairs (including depot)
    const pheromones = {};
    allPlaces.forEach(l1 => {
        const id1 = toId(l1._id);
        pheromones[id1] = {};
        allPlaces.forEach(l2 => {
            pheromones[id1][toId(l2._id)] = 1.0;
        });
    });

    let bestSolution = null;
    let bestCost = Infinity;

    for (let iter = 0; iter < numIterations; iter++) {
        const allAntSolutions = [];
        for (let ant = 0; ant < numAnts; ant++) {
            const solution = constructSolutionForAnt(vehicles, locations, depot, distances, pheromones, alpha, beta, options);
            // solution is array of routes; compute cost robustly
            const cost = solution.reduce((sum, route) => sum + (route.distance || 0), 0);
            allAntSolutions.push({ solution, cost });

            if (cost < bestCost) {
                bestCost = cost;
                bestSolution = solution;
            }
        }

        // evaporate
        Object.keys(pheromones).forEach(fromId => {
            Object.keys(pheromones[fromId]).forEach(toIdStr => {
                pheromones[fromId][toIdStr] *= (1 - rho);
                if (pheromones[fromId][toIdStr] < 1e-6) pheromones[fromId][toIdStr] = 1e-6; // keep numerical stability
            });
        });

        // deposit from best of iteration (if any)
        const iterBest = allAntSolutions.reduce((prev, curr) => (prev.cost <= curr.cost ? prev : curr), allAntSolutions[0] || { cost: Infinity });
        if (iterBest && iterBest.cost !== Infinity && iterBest.solution) {
            const delta = Q / Math.max(iterBest.cost, 1e-6);
            iterBest.solution.forEach(route => {
                for (let i = 0; i < (route.stops?.length || 0) - 1; i++) {
                    const fromId = toId(route.stops[i].locationId);
                    const toIdStr = toId(route.stops[i + 1].locationId);
                    // guard existence
                    if (!pheromones[fromId]) pheromones[fromId] = {};
                    if (!pheromones[fromId][toIdStr]) pheromones[fromId][toIdStr] = 0;
                    pheromones[fromId][toIdStr] += delta;
                }
            });
        }
    }

    console.log(`ACO finished. Best cost found: ${isFinite(bestCost) ? bestCost.toFixed(2) : 'n/a'}`);
    return bestSolution || [];
};
