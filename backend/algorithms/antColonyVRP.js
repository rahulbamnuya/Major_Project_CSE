const { calculateDistance, getDistanceMatrix } = require('../utils/optimizationUtils');

const toId = (objId) => objId && objId.toString();

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
    options,
    vehicle,
    config
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

        // INFRASTRUCTURE CHECK
        if (!options.isSolomonBenchmark) {
            const rt = (candidate.road_type || 'STANDARD').toUpperCase();
            const vt = (typeof vehicle.vehicle_type === 'string' ? vehicle.vehicle_type : 'LARGE').toUpperCase();
            if (rt === 'NARROW' && vt !== 'SMALL') continue;
            if (rt === 'STANDARD' && vt === 'LARGE') continue;
        }

        // distances
        const distCurToCand = (distances.distances[currentId] && distances.distances[currentId][candidateId]) ??
            calculateDistance(current.latitude, current.longitude, candidate.latitude, candidate.longitude);

        if (distCurToCand == null || Number.isNaN(distCurToCand)) continue;

        const travelTimeToCandidate = distances.durations[currentId]?.[candidateId] ?? (((distCurToCand / config.speedKmh) * 3600) * config.TRAFFIC_FACTOR);
        const arrivalAtCandidate = currentTime + travelTimeToCandidate;

        const serviceTimeRaw = (candidate.serviceTimeSeconds != null) 
            ? candidate.serviceTimeSeconds 
            : config.BASE_SERVICE_TIME_SECONDS + ((candidate.demand || 0) / config.UNITS_PER_SECOND_OF_UNLOADING);
        
        let serviceStart = arrivalAtCandidate;
        let departureFromCandidate = arrivalAtCandidate + serviceTimeRaw;

        if (options.useTimeWindows) {
            const candidateStartTime = (typeof candidate.startTimeWindowSeconds === 'number') ? candidate.startTimeWindowSeconds : 0;
            const candidateEndTime = (typeof candidate.endTimeWindowSeconds === 'number') ? candidate.endTimeWindowSeconds : config.DEPOT_END_TIME_SECONDS;

            if (arrivalAtCandidate > candidateEndTime) continue;
            serviceStart = Math.max(arrivalAtCandidate, candidateStartTime);
            departureFromCandidate = serviceStart + serviceTimeRaw;
            // Removed departure-based rejection to match Solomon benchmark standards
        }

        const pher = (pheromones[currentId] && pheromones[currentId][candidateId]) ?? 1;
        const heuristic = distCurToCand > 0 ? 1 / distCurToCand : 1;

        const prob = Math.pow(pher, alpha) * Math.pow(heuristic, beta);
        choices.push({ candidate, prob });
        totalProbability += prob;
    }

    if (choices.length === 0) return null;

    const r = Math.random() * totalProbability;
    let cum = 0;
    for (const c of choices) {
        cum += c.prob;
        if (r <= cum) return c.candidate;
    }
    return choices[choices.length - 1].candidate;
}

function constructSolutionForAnt(vehicles, locations, depot, distances, pheromones, alpha, beta, options, config) {
    const depotId = toId(depot._id);
    const unvisited = new Set(locations.filter(l => toId(l._id) !== depotId).map(l => toId(l._id)));
    const routes = [];

    const vehicleSlots = [];
    vehicles.forEach((v) => {
        const count = v.count || 1;
        for (let i = 0; i < count; i++) {
            vehicleSlots.push({ ...v, uniqueId: `${v._id}_${i}` });
        }
    });

    for (const vehicle of vehicleSlots) {
        if (unvisited.size === 0) break;

        const route = {
            vehicle: vehicle._id,
            vehicleName: vehicle.name,
            stops: [],
            totalCapacity: 0,
            distance: 0,
            duration: 0
        };

        let currentCapacity = 0;
        let currentLocation = depot;
        let currentTime = config.DEPOT_START_TIME_SECONDS;

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

        while (unvisited.size > 0) {
            const nextLocation = chooseNextLocation(
                currentLocation,
                unvisited,
                locations,
                vehicle.capacityWeight || vehicle.capacity || 1000,
                currentCapacity,
                distances,
                pheromones,
                alpha,
                beta,
                currentTime,
                depotId,
                options,
                vehicle,
                config
            );

            if (!nextLocation) break;

            const distCurToNext = (distances.distances[toId(currentLocation._id)]?.[toId(nextLocation._id)]) ??
                calculateDistance(currentLocation.latitude, currentLocation.longitude, nextLocation.latitude, nextLocation.longitude);

            const travelTime = (distances.durations[toId(currentLocation._id)]?.[toId(nextLocation._id)]) ?? (((distCurToNext / config.speedKmh) * 3600) * config.TRAFFIC_FACTOR);
            const arrivalTime = currentTime + travelTime;

            const demand = nextLocation.demandWeight || nextLocation.demand || 0;
            const serviceTime = (nextLocation.serviceTimeSeconds != null) 
                ? nextLocation.serviceTimeSeconds 
                : config.BASE_SERVICE_TIME_SECONDS + (demand / config.UNITS_PER_SECOND_OF_UNLOADING);

            let waitTime = 0;
            if (options.useTimeWindows) {
                const twStart = nextLocation.startTimeWindowSeconds || 0;
                waitTime = Math.max(0, twStart - arrivalTime);
            }

            const actualServiceStart = arrivalTime + waitTime;
            currentCapacity += demand;
            unvisited.delete(toId(nextLocation._id));

            route.stops.push({
                locationId: nextLocation._id,
                locationName: nextLocation.name,
                latitude: nextLocation.latitude,
                longitude: nextLocation.longitude,
                demand: demand,
                order: route.stops.length,
                arrivalTime: Math.round(arrivalTime),
                serviceTime: Math.round(serviceTime + waitTime),
                departureTime: Math.round(actualServiceStart + serviceTime)
            });

            route.distance += distCurToNext;
            currentLocation = nextLocation;
            currentTime = actualServiceStart + serviceTime;
        }

        // Return to depot
        const distToDepot = (distances.distances[toId(currentLocation._id)]?.[depotId]) ??
            calculateDistance(currentLocation.latitude, currentLocation.longitude, depot.latitude, depot.longitude);
        route.distance += distToDepot;
        
        route.stops.push({
            locationId: depot._id,
            locationName: depot.name,
            latitude: depot.latitude,
            longitude: depot.longitude,
            demand: 0,
            order: route.stops.length,
            arrivalTime: Math.round(currentTime + ((distToDepot / config.speedKmh) * 3600))
        });

        routes.push(route);
    }
    return routes;
}

exports.antColonyOptimizationVRP = async (vehicles, locations, depot, options = {}) => {
    const config = {
        TRAFFIC_FACTOR: options.trafficFactor !== undefined ? options.trafficFactor : 1.25,
        DEPOT_START_TIME_SECONDS: options.depotStartTime !== undefined ? options.depotStartTime : 6 * 3600,
        DEPOT_END_TIME_SECONDS: options.depotEndTime !== undefined ? options.depotEndTime : 22 * 3600,
        BASE_SERVICE_TIME_SECONDS: options.baseServiceTime !== undefined ? options.baseServiceTime : 3 * 60,
        UNITS_PER_SECOND_OF_UNLOADING: options.unitsPerSecond !== undefined ? options.unitsPerSecond : 10 / 60,
        speedKmh: options.avgSpeedKmh || 40
    };

    const allPlaces = [depot, ...locations];
    const distances = await getDistanceMatrix(allPlaces);

    const numAnts = 10;
    const numIterations = 20;
    const alpha = 1.0;
    const beta = 2.0;
    const rho = 0.1;
    const Q = 100;

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
        for (let ant = 0; ant < numAnts; ant++) {
            const solution = constructSolutionForAnt(vehicles, locations, depot, distances, pheromones, alpha, beta, options, config);
            const totalUnvisited = locations.length - solution.reduce((sum, r) => sum + r.stops.length - 2, 0);
            
            // Penalty for unvisited locations to force coverage
            const cost = solution.reduce((sum, route) => sum + route.distance, 0) + (totalUnvisited * 1000);

            if (cost < bestCost) {
                bestCost = cost;
                bestSolution = solution;
            }
        }
        // Simplified evaporation
        Object.keys(pheromones).forEach(id => {
            Object.keys(pheromones[id]).forEach(id2 => {
                pheromones[id][id2] *= (1 - rho);
            });
        });
    }

    return bestSolution;
};
