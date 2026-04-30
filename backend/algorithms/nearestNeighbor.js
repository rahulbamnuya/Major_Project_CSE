const { calculateDistance, getDistanceMatrix } = require('../utils/optimizationUtils');

const toId = (objId) => objId.toString();

exports.nearestNeighborAlgorithm = async (vehicles, locations, depot, options = {}) => {
    const useTimeWindows = options.useTimeWindows || false;
    const speedKmh = options.avgSpeedKmh || 40;
    const TRAFFIC_FACTOR = options.trafficFactor !== undefined ? options.trafficFactor : 1.25;
    const DEPOT_START_TIME_SECONDS = options.depotStartTime !== undefined ? options.depotStartTime : 6 * 3600;
    const DEPOT_END_TIME_SECONDS = options.depotEndTime !== undefined ? options.depotEndTime : 22 * 3600;
    const BASE_SERVICE_TIME_SECONDS = options.baseServiceTime !== undefined ? options.baseServiceTime : 3 * 60;
    const UNITS_PER_SECOND_OF_UNLOADING = options.unitsPerSecond !== undefined ? options.unitsPerSecond : 10 / 60;

    const depotId = toId(depot._id);
    const allLocations = [depot, ...locations];
    const distances = await getDistanceMatrix(allLocations);

    let pending = locations.filter((l) => toId(l._id) !== depotId);
    const used = new Set();
    const routes = [];

    const vehicleSlots = [];
    vehicles.forEach((v) => {
        const count = v.count || 1;
        for (let i = 0; i < count; i++) {
            vehicleSlots.push({ ...v, capacity: v.capacityWeight || v.capacity || 1000 });
        }
    });

    for (const vs of vehicleSlots) {
        if (used.size >= pending.length) break;

        let currentCapacity = 0;
        let currentLocation = depot;
        let currentTime = DEPOT_START_TIME_SECONDS;
        const stops = [{
            locationId: depot._id,
            locationName: depot.name,
            latitude: depot.latitude,
            longitude: depot.longitude,
            demand: 0,
            order: 0,
            arrivalTime: Math.round(currentTime),
            serviceTime: 0,
            departureTime: Math.round(currentTime)
        }];

        while (true) {
            let best = null;
            let bestDistance = Infinity;

            for (const loc of pending) {
                if (used.has(toId(loc._id))) continue;

                const demand = loc.demandWeight || loc.demand || 0;
                if (currentCapacity + demand > vs.capacity) continue;

                // INFRASTRUCTURE CHECK
                if (!options.isSolomonBenchmark) {
                    const rt = (loc.road_type || 'STANDARD').toUpperCase();
                    const vt = (vs.vehicle_type || 'LARGE').toUpperCase();
                    if (rt === 'NARROW' && vt !== 'SMALL') continue;
                    if (rt === 'STANDARD' && vt === 'LARGE') continue;
                }

                const d = distances.distances[toId(currentLocation._id)]?.[toId(loc._id)] ?? 
                          calculateDistance(currentLocation.latitude, currentLocation.longitude, loc.latitude, loc.longitude);
                
                const t = distances.durations[toId(currentLocation._id)]?.[toId(loc._id)] ?? 
                          (((d / speedKmh) * 3600) * TRAFFIC_FACTOR);
                
                const arrival = currentTime + t;
                const locEndTime = loc.endTimeWindowSeconds || DEPOT_END_TIME_SECONDS;

                // STRICT TIME WINDOW CHECK for the "Fixed" NN
                if (useTimeWindows && arrival > locEndTime) continue;

                if (d < bestDistance) {
                    bestDistance = d;
                    best = loc;
                }
            }

            if (!best) break;

            const dBest = bestDistance;
            const tBest = distances.durations[toId(currentLocation._id)]?.[toId(best._id)] ?? 
                          (((dBest / speedKmh) * 3600) * TRAFFIC_FACTOR);
            
            const arrival = currentTime + tBest;
            const locStartTime = best.startTimeWindowSeconds || 0;
            const wait = Math.max(0, locStartTime - arrival);
            
            const service = (best.serviceTimeSeconds != null) 
                ? best.serviceTimeSeconds 
                : BASE_SERVICE_TIME_SECONDS + ((best.demandWeight || best.demand || 0) / UNITS_PER_SECOND_OF_UNLOADING);

            used.add(toId(best._id));
            currentCapacity += (best.demandWeight || best.demand || 0);
            
            stops.push({
                locationId: best._id,
                locationName: best.name,
                latitude: best.latitude,
                longitude: best.longitude,
                demand: (best.demandWeight || best.demand || 0),
                order: stops.length,
                arrivalTime: Math.round(arrival),
                serviceTime: Math.round(service + wait),
                departureTime: Math.round(arrival + wait + service)
            });

            currentLocation = best;
            currentTime = arrival + wait + service;
        }

        // Return to depot
        const dDepot = distances.distances[toId(currentLocation._id)]?.[depotId] ?? 
                       calculateDistance(currentLocation.latitude, currentLocation.longitude, depot.latitude, depot.longitude);
        
        stops.push({
            locationId: depot._id,
            locationName: depot.name,
            latitude: depot.latitude,
            longitude: depot.longitude,
            demand: 0,
            order: stops.length,
            arrivalTime: Math.round(currentTime + ((dDepot / speedKmh) * 3600))
        });

        routes.push({
            vehicle: vs._id,
            vehicleName: vs.name,
            stops,
            distance: stops.reduce((sum, s, i) => {
                if (i === 0) return 0;
                const prev = stops[i-1];
                return sum + (distances.distances[toId(prev.locationId)]?.[toId(s.locationId)] ?? 
                              calculateDistance(prev.latitude, prev.longitude, s.latitude, s.longitude));
            }, 0)
        });
    }

    return routes;
};
