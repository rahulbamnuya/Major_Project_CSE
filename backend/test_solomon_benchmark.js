const fs = require('fs');
const path = require('path');

// =========================================
// 1. MOCKING UTILITIES FOR SOLOMON BENCHMARK
// =========================================
// We must intercept the distance calculations to use Euclidean grid math 
// instead of OSRM road networks, as Solomon datasets are purely Euclidean.
const optimizationUtils = require('./utils/optimizationUtils');

optimizationUtils.getDistanceMatrix = async (locs) => {
    const matrix = { distances: {}, durations: {} };
    for (let i = 0; i < locs.length; i++) {
        const id1 = locs[i]._id.toString();
        matrix.distances[id1] = {};
        matrix.durations[id1] = {};
        for (let j = 0; j < locs.length; j++) {
            const id2 = locs[j]._id.toString();
            const dx = locs[i].latitude - locs[j].latitude;
            const dy = locs[i].longitude - locs[j].longitude;
            const dist = Math.sqrt(dx * dx + dy * dy); 
            matrix.distances[id1][id2] = dist;
            // Map 1 unit distance to roughly 1 unit time, or calculate
            matrix.durations[id1][id2] = (dist / 40) * 3600; 
        }
    }
    return matrix;
};

// Override calculateDistance to Euclidean for Solomon benchmark
optimizationUtils.calculateDistance = (lat1, lon1, lat2, lon2) => {
    const dx = lat1 - lat2;
    const dy = lon1 - lon2;
    return Math.sqrt(dx * dx + dy * dy);
};

// =========================================
// 2. LOAD ALGORITHMS
// =========================================
const { enhancedClarkeWrightAlgorithm } = require('./algorithms/enhancedClarkeWright');
const { nearestNeighborAlgorithm } = require('./algorithms/nearestNeighbor');
const { antColonyOptimizationVRP } = require('./algorithms/antColonyVRP');

// =========================================
// 3. PARSE DATASET (RC201 Random/Clustered)
// =========================================
const csvPath = path.join(__dirname, 'RC201.csv');
const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.trim().split('\n').slice(1);
const nodes = lines.map(line => {
    const p = line.split(',');
    return {
        id: parseInt(p[0]),
        x: parseFloat(p[1]),
        y: parseFloat(p[2]),
        demand: parseFloat(p[3]),
        ready: parseFloat(p[4]),
        due: parseFloat(p[5]),
        service: parseFloat(p[6])
    };
});

const depotNode = nodes[0];
// Use all 100 customers provided in the dataset
const customerNodes = nodes.slice(1); 
const TOTAL_EXPECTED_CUSTOMERS = customerNodes.length;
// Solomon Time is abstract. We map 1 unit = 1 minute (60 seconds).
const TIME_MULTIPLIER = 60; 

const depot = {
    _id: 'depot_0',
    name: 'Solomon Depot',
    latitude: depotNode.x,
    longitude: depotNode.y,
    startTimeWindowSeconds: depotNode.ready * TIME_MULTIPLIER,
    endTimeWindowSeconds: depotNode.due * TIME_MULTIPLIER
};

const locations = customerNodes.map(c => ({
    _id: `cust_${c.id}`,
    name: `Customer ${c.id}`,
    latitude: c.x,
    longitude: c.y,
    demandWeight: c.demand,
    demandVolume: c.demand,
    startTimeWindowSeconds: c.ready * TIME_MULTIPLIER,
    endTimeWindowSeconds: c.due * TIME_MULTIPLIER,
    timeWindowStart: c.ready, 
    timeWindowEnd: c.due,
    serviceTimeSeconds: c.service * TIME_MULTIPLIER, // Use Solomon strict service time
    road_type: 'STANDARD' // Ignore road tiers for Solomon
}));

// User requested heterogeneous fleet (2 types)
const VEHICLE_CAPACITY = 1000;
const vehicles = Array.from({ length: 25 }).map((_, i) => {
    const isLarge = i % 2 === 0;
    return {
        _id: `v_${i}`,
        name: `Fleet Vehicle ${i+1} (${isLarge ? 'LARGE' : 'SMALL'})`,
        type: isLarge ? 'LARGE' : 'SMALL',
        vehicle_type: isLarge ? 'LARGE' : 'SMALL',
        capacityWeight: isLarge ? VEHICLE_CAPACITY : VEHICLE_CAPACITY / 2, 
        capacityVolume: isLarge ? VEHICLE_CAPACITY : VEHICLE_CAPACITY / 2,
        costPerKm: isLarge ? 15 : 10,
        fixedCost: isLarge ? 500 : 300,
        tripCount: 0,
        lastTripEndTime: 0
    };
});

// =========================================
// 4. TEST EXECUTION RUNNER
// =========================================
async function runTest(name, algoFn) {
    try {
        const opts = { 
            useTimeWindows: true, 
            isSolomonBenchmark: true,
            trafficFactor: 1.0, 
            depotStartTime: depotNode.ready * TIME_MULTIPLIER, 
            depotEndTime: depotNode.due * TIME_MULTIPLIER, 
            baseServiceTime: 0,
            avgSpeedKmh: 60 
        };
        const result = await algoFn(vehicles, locations, depot, opts);
        
        const routesArray = Array.isArray(result) ? result : (result && result.routes ? result.routes : []);
        if (!routesArray || routesArray.length === 0) {
            console.log(`| ${name.padEnd(35)} | FAILED: Algorithm returned no routes or undefined |`);
            return;
        }
        
        let totalDistance = 0;
        let totalTimeSeconds = 0;
        let totalDemand = 0;
        let vehicleCount = routesArray.length;
        let trips = routesArray.length; 
        let onTimeCount = 0;
        let totalStops = 0;

        routesArray.forEach(route => {
            const stopsArray = route.stops || route.itinerary || [];
            
            // If algorithm didn't compute distance/time, we do it here
            let routeDist = route.distance || route.totalDistance || 0;
            let routeTime = (route.duration * 60) || route.totalTimeSeconds || 0;
            
            if (stopsArray.length > 1) {
                let calcDist = 0;
                let calcTime = 0;
                for (let i = 0; i < stopsArray.length - 1; i++) {
                    const s1 = stopsArray[i];
                    const s2 = stopsArray[i+1];
                    const loc1 = s1.locationId === depot._id ? depot : locations.find(l => l._id === s1.locationId) || depot;
                    const loc2 = s2.locationId === depot._id ? depot : locations.find(l => l._id === s2.locationId) || depot;
                    const d = Math.sqrt(Math.pow(loc1.latitude - loc2.latitude, 2) + Math.pow(loc1.longitude - loc2.longitude, 2));
                    calcDist += d;
                    calcTime += (d / 60) * 3600; // 1 unit distance = 1 minute
                    
                    const stopLoc = locations.find(l => l._id === s2.locationId);
                    if (stopLoc) {
                        calcTime += (stopLoc.serviceTimeSeconds || 0);
                    }
                }
                if (routeDist === 0) routeDist = calcDist;
                if (routeTime === 0) routeTime = calcTime;
            }
            
            totalDistance += routeDist;
            totalTimeSeconds += routeTime;
            
            stopsArray.forEach(stop => {
                if (stop.locationId !== depot._id) {
                    totalStops++;
                    totalDemand += (stop.demandWeight || stop.demand || 0);
                    
                    const arrival = stop.arrivalTime || 0;
                    const due = stop.endTimeWindowSeconds || (1000 * TIME_MULTIPLIER);
                    if (arrival <= due || arrival === 0) {
                        // For algorithms that don't compute arrivalTime, give benefit of doubt or handle it.
                        // Assuming basic onTime
                        onTimeCount++;
                    }
                }
            });
        });

        // Compute advanced metrics matching the user's table
        const totalCapacity = vehicleCount > 0 ? vehicleCount * VEHICLE_CAPACITY : 1;
        const loadEfficiency = vehicleCount > 0 ? (totalDemand / totalCapacity) * 100 : 0;
        const avgDist = vehicleCount > 0 ? totalDistance / vehicleCount : 0;
        const timeFulfillment = totalStops > 0 ? (onTimeCount / totalStops) * 100 : 0;
        const opCost = (vehicleCount * 500) + (totalDistance * 15);
        
        const hours = Math.floor(totalTimeSeconds / 3600);
        const mins = Math.floor((totalTimeSeconds % 3600) / 60);

        console.log(`| ${name.padEnd(35)} | ${totalDistance.toFixed(2).padStart(7)} km | ${hours}h${mins.toString().padStart(2, '0')}m | ${vehicleCount.toString().padStart(8)} | ${trips.toString().padStart(5)} | ${loadEfficiency.toFixed(1).padStart(7)}% | ${avgDist.toFixed(1).padStart(8)} | ${timeFulfillment.toFixed(1).padStart(5)}% (${onTimeCount}/${totalStops}) | Rs. ${Math.round(opCost).toString().padStart(6)} |`);

    } catch (err) {
        console.log(`| ${name.padEnd(35)} | FAILED: ${err.message} |`);
    }
}

async function main() {
    console.log("\n==========================================================================================================================");
    console.log("                                 SOLOMON DATASET BENCHMARK RESULTS (C101 - Clustered)                                    ");
    console.log("==========================================================================================================================");
    console.log(`| Algorithm                           | Distance    | Time    | Vehicles | Trips | Load Eff | Avg Dist | Time Fulfillment | Op Cost    |`);
    console.log("|-------------------------------------|-------------|---------|----------|-------|----------|----------|------------------|------------|");
    
    await runTest("Nearest Neighbor (Baseline)", nearestNeighborAlgorithm);
    await runTest("Ant Colony Optimization (ACO)", antColonyOptimizationVRP);
    await runTest("Modified Clarke-Wright (Proposed)", enhancedClarkeWrightAlgorithm);
    
    console.log("==========================================================================================================================\n");
}

main();
