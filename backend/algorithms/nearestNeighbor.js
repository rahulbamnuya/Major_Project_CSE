// /algorithms/nearestNeighbor.js
const { calculateDistance } = require('../utils/optimizationUtils');

// =================================================================
// CONSTANTS
// =================================================================
const BASE_SERVICE_TIME_SECONDS = 3 * 60; // 3 minutes
const UNITS_PER_SECOND_OF_UNLOADING = 10 / 60; // 10 units per minute
const DEFAULT_SPEED_KMH = 40;
const TRAFFIC_FACTOR = 1.25;
const DEPOT_START_TIME_SECONDS = 6 * 3600; // 6:00 AM
const DEPOT_END_TIME_SECONDS = 22 * 3600; // 10:00 PM

// =================================================================
// HELPER: ObjectId to string
// =================================================================
const toId = (id) => id.toString();

// =================================================================
// MAIN: Nearest Neighbor Algorithm with Time Windows
// =================================================================
// =================================================================
// MAIN: Nearest Neighbor Algorithm with Time Windows
// =================================================================
exports.nearestNeighborAlgorithm = (vehicles, locations, depot, options = {}) => {
    const useTimeWindows = options.useTimeWindows || false;
    const speedKmh = options.avgSpeedKmh || DEFAULT_SPEED_KMH;

    console.log(`🚚 Running Nearest Neighbor (Time Windows: ${useTimeWindows}, Speed: ${speedKmh}km/h)...`);

    const depotId = toId(depot._id);
    const pending = locations.filter((l) => toId(l._id) !== depotId);

    // Expand vehicles by count
    const vehicleSlots = [];
    vehicles.forEach((v) => {
        const count = v.count || 1;
        for (let i = 0; i < count; i++) {
            vehicleSlots.push({ 
                _id: v._id, 
                name: v.name, 
                capacity: v.capacity || 0,
                vehicle_type: v.vehicle_type 
            });
        }
    });

    const routes = [];
    const used = new Set();

    const dist = (a, b) => calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude);

    // HELPER: Compute travel time in seconds
    const computeTravelTime = (distanceKm) => {
        // (Distance in km / Speed in km/h) * 3600 seconds/hour * Traffic
        return ((distanceKm / speedKmh) * 3600) * TRAFFIC_FACTOR;
    };

    for (const vs of vehicleSlots) {
        let remainingCapacity = vs.capacity;
        let currentLocation = depot;
        let currentTime = DEPOT_START_TIME_SECONDS;
        const stops = [
            {
                locationId: depot._id,
                locationName: depot.name,
                latitude: depot.latitude,
                longitude: depot.longitude,
                demand: 0,
                order: 0,
                arrivalTime: DEPOT_START_TIME_SECONDS,
                serviceTime: 0,
                departureTime: DEPOT_START_TIME_SECONDS,
            },
        ];
        let order = 1;

        while (true) {
            // Find nearest feasible location
            let best = null;
            let bestDistance = Infinity;

            for (const loc of pending) {
                if (used.has(toId(loc._id))) continue;
                if ((loc.demand || 0) > remainingCapacity) continue;

                // INFRASTRUCTURE CHECK
                const rt = (loc.road_type || 'STANDARD').toUpperCase();
                const vt = (vs.vehicle_type || 'LARGE').toUpperCase();
                
                // RULE 1: NARROW -> Only SMALL
                if (rt === 'NARROW' && vt !== 'SMALL') continue;
                
                // RULE 2: STANDARD -> No LARGE
                if (rt === 'STANDARD' && vt === 'LARGE') continue;

                const travelDistance = dist(currentLocation, loc);
                const travelTime = computeTravelTime(travelDistance);
                let arrivalTime = currentTime + travelTime;

                // Time window check (Relaxed to avoid dropping nodes)
                if (useTimeWindows) {
                    const startTW = loc.timeWindow ? loc.timeWindow[0] * 60 : 0;
                    // We don't 'continue' anymore; we just let it be late.
                    arrivalTime = Math.max(arrivalTime, startTW);
                }

                if (travelDistance < bestDistance) {
                    bestDistance = travelDistance;
                    best = loc;
                }
            }

            if (!best) break;

            const demand = best.demand || 0;
            const serviceTime = BASE_SERVICE_TIME_SECONDS + (demand / UNITS_PER_SECOND_OF_UNLOADING);

            // Arrival / Service / Departure time
            const travelDistBest = dist(currentLocation, best);
            const travelTimeBest = computeTravelTime(travelDistBest);

            let arrivalTime = currentTime + travelTimeBest;
            let waitTime = 0;
            if (useTimeWindows) {
                const startTW = best.timeWindow ? best.timeWindow[0] * 60 : 0;
                if (arrivalTime < startTW) {
                    waitTime = startTW - arrivalTime;
                    arrivalTime = startTW;
                }
            }
            const departureTime = arrivalTime + serviceTime;

            stops.push({
                locationId: best._id,
                locationName: best.name,
                latitude: best.latitude,
                longitude: best.longitude,
                demand,
                order: order++,
                arrivalTime: Math.round(arrivalTime),
                serviceTime: Math.round(serviceTime),
                departureTime: Math.round(departureTime),
                startTimeWindowSeconds: best.timeWindow ? best.timeWindow[0] * 60 : null,
                endTimeWindowSeconds: best.timeWindow ? best.timeWindow[1] * 60 : null,
                road_type: best.road_type || 'STANDARD',
            });

            remainingCapacity -= demand;
            currentTime = departureTime;
            currentLocation = best;
            used.add(toId(best._id));
        }

        // Close route back to depot
        if (stops.length > 1) {
            const travelDistanceToDepot = dist(currentLocation, depot);
            const travelTimeToDepot = computeTravelTime(travelDistanceToDepot);
            const arrivalTimeDepot = currentTime + travelTimeToDepot;

            stops.push({
                locationId: depot._id,
                locationName: depot.name,
                latitude: depot.latitude,
                longitude: depot.longitude,
                demand: 0,
                order: order,
                arrivalTime: Math.round(arrivalTimeDepot),
                serviceTime: 0,
                departureTime: Math.round(arrivalTimeDepot),
            });

            // Calculate total distance
            let totalDistance = 0;
            for (let i = 0; i < stops.length - 1; i++) {
                totalDistance += dist(stops[i], stops[i + 1]);
            }

            routes.push({
                vehicle: vs._id,
                vehicleName: vs.name,
                stops,
                distance: totalDistance,
                duration: Math.round((arrivalTimeDepot - DEPOT_START_TIME_SECONDS) / 60),
                totalCapacity: vs.capacity - remainingCapacity,
            });
        }

        if (used.size === pending.length) break;
    }

    return routes;
};
