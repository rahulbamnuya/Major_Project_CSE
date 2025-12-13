// // /algorithms/geneticAlgorithmVRP.js
// const { calculateDistance, calculateTotalCost } = require('../utils/optimizationUtils');

// // =================================================================
// // Constants
// // =================================================================
// const DEFAULT_SPEED_KMH = 40;

// // =================================================================
// // Helper: Convert ObjectId to string
// // =================================================================
// const toId = (objId) => objId.toString();

// // =================================================================
// // Helper: Recompute distance and duration for a route
// // =================================================================
// function recomputeRouteMetricsInline(route, distances, speedKmh = DEFAULT_SPEED_KMH) {
//   let totalDistance = 0;

//   for (let k = 0; k < route.stops.length - 1; k++) {
//     const from = route.stops[k];
//     const to = route.stops[k + 1];
//     const fromIdStr = toId(from.locationId);
//     const toIdStr = toId(to.locationId);

//     totalDistance += distances[fromIdStr]?.[toIdStr] || calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
//   }

//   route.distance = totalDistance;
//   route.duration = Math.round((totalDistance / speedKmh) * 60); // minutes
// }

// // =================================================================
// // Helper: Create random initial solution
// // =================================================================
// function createRandomSolution(vehicles, locations, depot, distances, speedKmh = DEFAULT_SPEED_KMH) {
//   const depotId = toId(depot._id);
//   const nonDepot = locations.filter(l => toId(l._id) !== depotId);
//   const shuffledLocations = [...nonDepot].sort(() => Math.random() - 0.5);

//   const vehicleSlots = vehicles.flatMap(v =>
//     Array(v.count || 1).fill(null).map(() => ({
//       vehicle: v,
//       locations: [],
//       capacity: v.capacity || 0,
//       usedCapacity: 0
//     }))
//   );

//   // Assign customers to vehicles respecting capacity
//   for (const loc of shuffledLocations) {
//     const slot = vehicleSlots.find(s => (s.usedCapacity + (loc.demand || 0)) <= s.capacity);
//     if (slot) {
//       slot.locations.push(loc);
//       slot.usedCapacity += loc.demand || 0;
//     }
//   }

//   // Build routes
//   const routes = [];
//   vehicleSlots.forEach(slot => {
//     if (slot.locations.length === 0) return;

//     const stops = [
//       { locationId: depot._id, locationName: depot.name, latitude: depot.latitude, longitude: depot.longitude, demand: 0, order: 0 },
//       ...slot.locations.map((loc, idx) => ({
//         locationId: loc._id,
//         locationName: loc.name,
//         latitude: loc.latitude,
//         longitude: loc.longitude,
//         demand: loc.demand || 0,
//         order: idx + 1
//       })),
//       { locationId: depot._id, locationName: depot.name, latitude: depot.latitude, longitude: depot.longitude, demand: 0, order: slot.locations.length + 1 }
//     ];

//     const route = {
//       vehicle: slot.vehicle._id,
//       vehicleName: slot.vehicle.name,
//       stops,
//       totalCapacity: slot.usedCapacity
//     };

//     recomputeRouteMetricsInline(route, distances, speedKmh);
//     routes.push(route);
//   });

//   return routes;
// }

// // =================================================================
// // Helper: Tournament selection
// // =================================================================
// function tournamentSelection(population, distances, tournamentSize = 3) {
//   let best = population[Math.floor(Math.random() * population.length)];
//   for (let i = 1; i < tournamentSize; i++) {
//     const candidate = population[Math.floor(Math.random() * population.length)];
//     if (calculateTotalCost(candidate, distances) < calculateTotalCost(best, distances)) {
//       best = candidate;
//     }
//   }
//   return best;
// }

// // =================================================================
// // Helper: Crossover
// // =================================================================
// function crossover(parent1, parent2, distances, speedKmh = DEFAULT_SPEED_KMH) {
//   if (!Array.isArray(parent1) || !Array.isArray(parent2)) return JSON.parse(JSON.stringify(parent1 || parent2 || []));

//   const child = [];
//   const maxRoutes = Math.max(parent1.length, parent2.length);

//   for (let i = 0; i < maxRoutes; i++) {
//     if (i < parent1.length && i < parent2.length) {
//       child.push(JSON.parse(JSON.stringify(Math.random() < 0.5 ? parent1[i] : parent2[i])));
//     } else if (i < parent1.length) {
//       child.push(JSON.parse(JSON.stringify(parent1[i])));
//     } else if (i < parent2.length) {
//       child.push(JSON.parse(JSON.stringify(parent2[i])));
//     }
//   }

//   child.forEach(route => recomputeRouteMetricsInline(route, distances, speedKmh));
//   return child;
// }

// // =================================================================
// // Helper: Mutation
// // =================================================================
// function mutate(solution, distances, speedKmh = DEFAULT_SPEED_KMH) {
//   if (!solution || solution.length === 0) return;

//   const routeIndex = Math.floor(Math.random() * solution.length);
//   const route = solution[routeIndex];

//   if (route.stops.length > 3) {
//     let i = Math.floor(Math.random() * (route.stops.length - 2)) + 1;
//     let j = Math.floor(Math.random() * (route.stops.length - 2)) + 1;
//     if (i === j) j = (j % (route.stops.length - 2)) + 1;

//     [route.stops[i], route.stops[j]] = [route.stops[j], route.stops[i]];
//     route.stops.forEach((s, idx) => s.order = idx);

//     recomputeRouteMetricsInline(route, distances, speedKmh);
//   }
// }

// // =================================================================
// // Main: Genetic Algorithm VRP
// // =================================================================
// exports.geneticAlgorithmVRP = (vehicles, locations, depot, options = {}) => {
//   const speedKmh = DEFAULT_SPEED_KMH;
//   const depotId = toId(depot._id);

//   // Build distance matrix
//   const distances = {};
//   locations.forEach(l1 => {
//     distances[toId(l1._id)] = {};
//     locations.forEach(l2 => {
//       distances[toId(l1._id)][toId(l2._id)] = calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
//     });
//   });

//   const nonDepot = locations.filter(l => toId(l._id) !== depotId);

//   // GA parameters
//   const populationSize = Math.min(30, Math.max(10, nonDepot.length * 2));
//   const generations = Math.min(50, Math.max(15, nonDepot.length * 2));
//   const mutationRate = 0.1;
//   const crossoverRate = 0.8;
//   const tournamentSize = 3;

//   // Initial population
//   let population = Array.from({ length: populationSize }, () =>
//     createRandomSolution(vehicles, locations, depot, distances, speedKmh)
//   );

//   // Best solution tracking
//   let bestSolution = population.reduce((best, cur) =>
//     calculateTotalCost(cur, distances) < calculateTotalCost(best, distances) ? cur : best
//   );

//   // Main GA loop
//   for (let gen = 0; gen < generations; gen++) {
//     const newPopulation = [JSON.parse(JSON.stringify(bestSolution))]; // elitism

//     while (newPopulation.length < populationSize) {
//       const parent1 = tournamentSelection(population, distances, tournamentSize);
//       const parent2 = tournamentSelection(population, distances, tournamentSize);

//       let offspring = Math.random() < crossoverRate
//         ? crossover(parent1, parent2, distances, speedKmh)
//         : JSON.parse(JSON.stringify(parent1));

//       if (Math.random() < mutationRate) mutate(offspring, distances, speedKmh);
//       newPopulation.push(offspring);
//     }

//     population = newPopulation;

//     const currentBest = population.reduce((best, cur) =>
//       calculateTotalCost(cur, distances) < calculateTotalCost(best, distances) ? cur : best
//     );

//     if (calculateTotalCost(currentBest, distances) < calculateTotalCost(bestSolution, distances)) {
//       bestSolution = JSON.parse(JSON.stringify(currentBest));
//     }
//   }

//   return bestSolution;
// };
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
// /algorithms/geneticAlgorithmVRP.js
const { calculateDistance, calculateTotalCost } = require('../utils/optimizationUtils');

// =================================================================
// CONSTANTS
// =================================================================
const DEFAULT_SPEED_KMH = 40;
const TRAFFIC_FACTOR = 1.25;
const BASE_SERVICE_TIME_SECONDS = 3 * 60; // 3 minutes
const UNITS_PER_SECOND_OF_UNLOADING = 10 / 60; // 10 units per minute
const DEPOT_START_TIME_SECONDS = 360 * 60; // 6:00 AM
const DEPOT_END_TIME_SECONDS = 1080 * 60;  // 6:00 PM

// =================================================================
// HELPER: ObjectId to string
// =================================================================
const toId = (objId) => objId.toString();

// =================================================================
// HELPER: Recompute route metrics including time windows
// =================================================================
function recomputeRouteMetrics(route, distances, useTimeWindows = false, speedKmh = DEFAULT_SPEED_KMH) {
    let totalDistance = 0;
    let currentTime = DEPOT_START_TIME_SECONDS;

    for (let i = 0; i < route.stops.length - 1; i++) {
        const from = route.stops[i];
        const to = route.stops[i + 1];
        const fromIdStr = toId(from.locationId);
        const toIdStr = toId(to.locationId);

        const distance = distances[fromIdStr]?.[toIdStr] || calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
        totalDistance += distance;

        let travelTime = (distance / speedKmh) * 3600 * TRAFFIC_FACTOR; // seconds
        let arrivalTime = currentTime + travelTime;

        // Service time
        const demand = to.demand || 0;
        let serviceTime = BASE_SERVICE_TIME_SECONDS + (demand / UNITS_PER_SECOND_OF_UNLOADING);

        // Handle time windows
        if (useTimeWindows && to.startTimeWindowSeconds !== undefined) {
            const twStart = to.startTimeWindowSeconds || 0;
            const twEnd = to.endTimeWindowSeconds || DEPOT_END_TIME_SECONDS;
            if (arrivalTime < twStart) serviceTime += (twStart - arrivalTime);
            arrivalTime = Math.max(arrivalTime, twStart);
            // If arrival after window end, we could mark infeasible (optional)
        }

        to.arrivalTime = Math.round(arrivalTime);
        to.serviceTime = Math.round(serviceTime);
        currentTime = arrivalTime + serviceTime;
    }

    route.distance = totalDistance;
    route.duration = Math.round((currentTime - DEPOT_START_TIME_SECONDS) / 60); // minutes
}

// =================================================================
// HELPER: Create random initial solution with time windows
// =================================================================
function createRandomSolution(vehicles, locations, depot, distances, useTimeWindows = false, speedKmh = DEFAULT_SPEED_KMH) {
    const depotId = toId(depot._id);
    const nonDepot = locations.filter(l => toId(l._id) !== depotId);
    const shuffledLocations = [...nonDepot].sort(() => Math.random() - 0.5);

    const vehicleSlots = vehicles.flatMap(v =>
        Array(v.count || 1).fill(null).map(() => ({
            vehicle: v,
            locations: [],
            capacity: v.capacity || 0,
            usedCapacity: 0
        }))
    );

    for (const loc of shuffledLocations) {
        const slot = vehicleSlots.find(s => (s.usedCapacity + (loc.demand || 0)) <= s.capacity);
        if (slot) {
            slot.locations.push(loc);
            slot.usedCapacity += loc.demand || 0;
        }
    }

    const routes = [];
    vehicleSlots.forEach(slot => {
        if (slot.locations.length === 0) return;

        const stops = [
            { locationId: depot._id, locationName: depot.name, latitude: depot.latitude, longitude: depot.longitude, demand: 0, order: 0, arrivalTime: DEPOT_START_TIME_SECONDS, serviceTime: 0 },
            ...slot.locations.map((loc, idx) => ({
                locationId: loc._id,
                locationName: loc.name,
                latitude: loc.latitude,
                longitude: loc.longitude,
                demand: loc.demand || 0,
                order: idx + 1,
                arrivalTime: 0,
                serviceTime: 0,
                startTimeWindowSeconds: loc.startTimeWindowSeconds,
                endTimeWindowSeconds: loc.endTimeWindowSeconds
            })),
            { locationId: depot._id, locationName: depot.name, latitude: depot.latitude, longitude: depot.longitude, demand: 0, order: slot.locations.length + 1, arrivalTime: 0, serviceTime: 0 }
        ];

        const route = { vehicle: slot.vehicle._id, vehicleName: slot.vehicle.name, stops, totalCapacity: slot.usedCapacity };
        recomputeRouteMetrics(route, distances, useTimeWindows, speedKmh);
        routes.push(route);
    });

    return routes;
}

// =================================================================
// HELPER: Tournament selection
// =================================================================
function tournamentSelection(population, distances, tournamentSize = 3) {
    let best = population[Math.floor(Math.random() * population.length)];
    for (let i = 1; i < tournamentSize; i++) {
        const candidate = population[Math.floor(Math.random() * population.length)];
        if (calculateTotalCost(candidate, distances) < calculateTotalCost(best, distances)) best = candidate;
    }
    return best;
}

// =================================================================
// HELPER: Crossover
// =================================================================
function crossover(parent1, parent2, distances, useTimeWindows = false, speedKmh = DEFAULT_SPEED_KMH) {
    if (!Array.isArray(parent1) || !Array.isArray(parent2)) return JSON.parse(JSON.stringify(parent1 || parent2 || []));

    const child = [];
    const maxRoutes = Math.max(parent1.length, parent2.length);

    for (let i = 0; i < maxRoutes; i++) {
        if (i < parent1.length && i < parent2.length) {
            child.push(JSON.parse(JSON.stringify(Math.random() < 0.5 ? parent1[i] : parent2[i])));
        } else if (i < parent1.length) {
            child.push(JSON.parse(JSON.stringify(parent1[i])));
        } else if (i < parent2.length) {
            child.push(JSON.parse(JSON.stringify(parent2[i])));
        }
    }

    child.forEach(route => recomputeRouteMetrics(route, distances, useTimeWindows, speedKmh));
    return child;
}

// =================================================================
// HELPER: Mutation
// =================================================================
function mutate(solution, distances, useTimeWindows = false, speedKmh = DEFAULT_SPEED_KMH) {
    if (!solution || solution.length === 0) return;

    const routeIndex = Math.floor(Math.random() * solution.length);
    const route = solution[routeIndex];
    if (route.stops.length <= 3) return;

    let i = Math.floor(Math.random() * (route.stops.length - 2)) + 1;
    let j = Math.floor(Math.random() * (route.stops.length - 2)) + 1;
    if (i === j) j = (j % (route.stops.length - 2)) + 1;

    [route.stops[i], route.stops[j]] = [route.stops[j], route.stops[i]];
    route.stops.forEach((s, idx) => s.order = idx);

    recomputeRouteMetrics(route, distances, useTimeWindows, speedKmh);
}

// =================================================================
// MAIN: Genetic Algorithm VRP with Time Windows
// =================================================================
exports.geneticAlgorithmVRP = (vehicles, locations, depot, options = {}) => {
    const useTimeWindows = options.useTimeWindows || false;
    const speedKmh = DEFAULT_SPEED_KMH;

    const distances = {};
    locations.forEach(l1 => {
        distances[toId(l1._id)] = {};
        locations.forEach(l2 => {
            distances[toId(l1._id)][toId(l2._id)] = calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
        });
    });

    const nonDepot = locations.filter(l => toId(l._id) !== toId(depot._id));
    const populationSize = Math.min(30, Math.max(10, nonDepot.length * 2));
    const generations = Math.min(50, Math.max(15, nonDepot.length * 2));
    const mutationRate = 0.1;
    const crossoverRate = 0.8;
    const tournamentSize = 3;

    let population = Array.from({ length: populationSize }, () =>
        createRandomSolution(vehicles, locations, depot, distances, useTimeWindows, speedKmh)
    );

    let bestSolution = population.reduce((best, cur) =>
        calculateTotalCost(cur, distances) < calculateTotalCost(best, distances) ? cur : best
    );

    for (let gen = 0; gen < generations; gen++) {
        const newPopulation = [JSON.parse(JSON.stringify(bestSolution))];

        while (newPopulation.length < populationSize) {
            const parent1 = tournamentSelection(population, distances, tournamentSize);
            const parent2 = tournamentSelection(population, distances, tournamentSize);

            let offspring = Math.random() < crossoverRate
                ? crossover(parent1, parent2, distances, useTimeWindows, speedKmh)
                : JSON.parse(JSON.stringify(parent1));

            if (Math.random() < mutationRate) mutate(offspring, distances, useTimeWindows, speedKmh);
            newPopulation.push(offspring);
        }

        population = newPopulation;

        const currentBest = population.reduce((best, cur) =>
            calculateTotalCost(cur, distances) < calculateTotalCost(best, distances) ? cur : best
        );

        if (calculateTotalCost(currentBest, distances) < calculateTotalCost(bestSolution, distances)) {
            bestSolution = JSON.parse(JSON.stringify(currentBest));
        }
    }

    return bestSolution;
};
