const Optimization = require('../models/Optimization');
const Vehicle = require('../models/Vehicle');
const Location = require('../models/Location');

// UTILS
const { assignVehiclesToRoutes } = require('../utils/optimizationUtils');
const { getOsrmRouteForStops } = require('../utils/osrmUtils');

// ALGORITHMS (Ensure all are imported)
// Assuming the new CW file is aliased as 'clarkeWrightAlgorithm'
const { clarkeWrightAlgorithmWithTimeWindows } = require('../algorithms/clarkeWright');
const { nearestNeighborAlgorithm } = require('../algorithms/nearestNeighbor');
const { geneticAlgorithmVRP } = require('../algorithms/geneticAlgorithmVRP');
const { antColonyOptimizationVRP } = require('../algorithms/antColonyVRP');
const { orToolsAlgorithm } = require('../algorithms/orTools');

/**
 * GET /api/optimizations
 * Get all optimizations for the logged-in user.
 */
exports.getOptimizations = async (req, res) => {
  try {
    const optimizations = await Optimization.find({ user: req.user.id })
      .populate('vehicles')
      .populate('locations')
      .sort({ createdAt: -1 });
    res.json(optimizations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/**
 * GET /api/optimizations/:id
 * Get a single optimization by its ID.
 */
exports.getOptimizationById = async (req, res) => {
  try {
    const optimization = await Optimization.findById(req.params.id)
      .populate('vehicles')
      .populate('locations');

    if (!optimization) {
      return res.status(404).json({ msg: 'Optimization not found' });
    }
    if (optimization.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    res.json(optimization);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Optimization not found' });
    }
    res.status(500).send('Server error');
  }
};


/**
 * POST /api/optimizations
 * Create a new route optimization for a single algorithm or a comparison.
 */
// exports.createOptimization = async (req, res) => {
//  const { name, vehicleIds, locationIds, algorithm, runComparison = false } = req.body;
//  console.log(req.body);
  
//   // Coerce useTimeWindows into a strict boolean
//   let useTimeWindows = req.body.useTimeWindows;
//   if (typeof useTimeWindows === 'string') {
//     useTimeWindows = useTimeWindows.toLowerCase() === 'true';
//   } else {
//     useTimeWindows = !!useTimeWindows;
//   }
  
//   console.log(`Starting optimization creation for '${name}'. Comparison mode: ${runComparison}, Use Time Windows: ${useTimeWindows}`);

//   try {
//     // 1. Fetch all required data from the database
//     const [vehicles, allLocations] = await Promise.all([
//       Vehicle.find({ _id: { $in: vehicleIds }, user: req.user.id }),
//       Location.find({ _id: { $in: locationIds }, user: req.user.id })
//     ]);
    
//     // Basic validation
//     if (vehicles.length === 0 || allLocations.length === 0) {
//       return res.status(400).json({ msg: 'Invalid vehicle or location IDs provided.' });
//     }
    
//     const depot = allLocations.find(loc => loc.isDepot);
//     const locations = allLocations.filter(loc => !loc.isDepot);
    
//     if (!depot) {
//         return res.status(400).json({ msg: 'A depot location must be included.' });
//     }

//     // 2. Define the map of all available algorithms
//     const algorithmMap = {
//       'clarke-wright': { name: 'Clarke-Wright Savings', function: clarkeWrightAlgorithmWithTimeWindows },
//       'nearest-neighbor': { name: 'Nearest Neighbor', function: nearestNeighborAlgorithm },
//       'genetic': { name: 'Genetic Algorithm', function: geneticAlgorithmVRP },
//       'ant-colony': { name: 'Ant Colony Optimization', function: antColonyOptimizationVRP },
//       'or-tools': { name: 'Google OR-Tools', function: orToolsAlgorithm }
//     };

//     // 3. Create a shared context object to pass to the runner functions
//     const optimizationContext = {
//       name,
//       user: req.user,
//       vehicleIds,
//       locationIds,
//       vehicles,
//       locations, // Non-depot locations
//       depot,
//       algorithmMap,
//       useTimeWindows
//     };

//     // 4. Route to the appropriate runner function
//     if (runComparison) {
//       return runAlgorithmComparison(req, res, optimizationContext);
//     } else {
//       optimizationContext.algorithm = algorithm;
//       return runSingleAlgorithm(req, res, optimizationContext);
//     }

//   } catch (err) {
//     console.error('FATAL: Optimization creation failed.', err);
//     res.status(500).json({ msg: 'Server error during optimization creation' });
//   }
// };

exports.createOptimization = async (req, res) => {
  const { name, vehicleIds, locationIds, algorithm, runComparison = false } = req.body;
  
  // Coerce useTimeWindows into a strict boolean
  let useTimeWindows = req.body.useTimeWindows;
  if (typeof useTimeWindows === 'string') {
    useTimeWindows = useTimeWindows.toLowerCase() === 'true';
  } else {
    useTimeWindows = !!useTimeWindows;
  }

  console.log(`Starting optimization creation for '${name}'. Comparison mode: ${runComparison}, Use Time Windows: ${useTimeWindows}`);

  try {
    // 1. Fetch all required data from DB
    let [vehicles, allLocations] = await Promise.all([
      Vehicle.find({ _id: { $in: vehicleIds }, user: req.user.id }),
      Location.find({ _id: { $in: locationIds }, user: req.user.id })
    ]);

    if (vehicles.length === 0) {
      return res.status(400).json({ msg: 'No valid vehicles provided.' });
    }

    // 2. Ensure depot exists: Add Sanchi Factory if none is marked as depot
    let depot = allLocations.find(loc => loc.isDepot);
    if (!depot) {
      const depotData = {
        name: 'Sanchi Factory, Indore Sahakari Dugdh Sangh Maryadit, Indore, Madhya Pradesh, 452001, India',
        latitude: 22.7670,
        longitude: 75.8895,
        demand: 0,
        isDepot: true,
        timeWindow: [6 * 60, 18 * 60], // 06:00 - 18:00 in minutes
        user: req.user.id
      };
      // Create depot in DB and add to locations
      depot = await Location.create(depotData);
      allLocations.push(depot);
      console.log('📍 Added default depot location:', depot.name);
    }

    const locations = allLocations.filter(loc => !loc.isDepot);

    if (!depot) {
      return res.status(400).json({ msg: 'A depot location must be included.' });
    }

    // 3. Algorithm mapping
    const algorithmMap = {
      'clarke-wright': { name: 'Clarke-Wright Savings', function: clarkeWrightAlgorithmWithTimeWindows },
      'nearest-neighbor': { name: 'Nearest Neighbor', function: nearestNeighborAlgorithm },
      'genetic': { name: 'Genetic Algorithm', function: geneticAlgorithmVRP },
      'ant-colony': { name: 'Ant Colony Optimization', function: antColonyOptimizationVRP },
      'or-tools': { name: 'Google OR-Tools', function: orToolsAlgorithm }
    };

    const optimizationContext = {
      name,
      user: req.user,
      vehicleIds,
      locationIds,
      vehicles,
      locations, // Non-depot locations
      depot,
      algorithmMap,
      useTimeWindows
    };

    // 4. Run comparison or single algorithm
    if (runComparison) {
      return runAlgorithmComparison(req, res, optimizationContext);
    } else {
      optimizationContext.algorithm = algorithm;
      return runSingleAlgorithm(req, res, optimizationContext);
    }

  } catch (err) {
    console.error('FATAL: Optimization creation failed.', err);
    res.status(500).json({ msg: 'Server error during optimization creation' });
  }
};

/**
 * NEW: Orchestrates a robust comparison run of all available algorithms.
 * This function iterates through all algorithms, runs them, and collects their performance data.
 */
/**
 * Enhanced route metrics with deeper insights for comparison.
 */

/**
 * Enhanced algorithm comparison runner that adds richer metrics.
 */
async function runAlgorithmComparison(req, res, context) {
  const { name, user, vehicleIds, locationIds, vehicles, locations, depot, algorithmMap, useTimeWindows } = context;
  const allAlgorithmResults = [];

  console.log('--- STARTING ALGORITHM COMPARISON RUN ---');
  console.log(`Depot: ${depot.name}, Locations: ${locations.length}, Vehicles: ${vehicles.length}`);

  const algorithmOptions = { useTimeWindows };

  for (const [key, algo] of Object.entries(algorithmMap)) {
    console.log(`\n[Comparison] Running -> ${algo.name}...`);
    const startTime = Date.now();

    try {
      const rawRoutes = await Promise.resolve(algo.function(vehicles, locations, depot, algorithmOptions));
      const executionTime = Date.now() - startTime;

      const finalRoutes = assignVehiclesToRoutes(rawRoutes, vehicles);
      const metrics = calculateRouteMetrics(finalRoutes, locations, vehicles, depot._id, useTimeWindows);

      console.log(`[Comparison] SUCCESS: ${algo.name} finished in ${executionTime}ms.`);

      allAlgorithmResults.push({
        algorithm: algo.name,
        algorithmKey: key,
        routes: finalRoutes,
        executionTime,
        ...metrics
      });
    } catch (algoErr) {
      const executionTime = Date.now() - startTime;
      console.error(`[Comparison] FAILED: ${algo.name} crashed after ${executionTime}ms. Error: ${algoErr.message}`);

      allAlgorithmResults.push({
        algorithm: algo.name,
        algorithmKey: key,
        error: algoErr.message || 'Unknown execution error',
        executionTime,
        routes: [],
        totalDistance: 0,
        totalDuration: 0,
        coveragePercentage: 0
      });
    }
  }

  console.log('\n--- ALGORITHM COMPARISON FINISHED ---');

  const bestResult = findBestResult(allAlgorithmResults);
  console.log(`Best algorithm determined: ${bestResult.algorithm || 'N/A'}`);

  const newOptimization = new Optimization({
    name,
    user: user.id,
    vehicles: vehicleIds,
    locations: locationIds,
    algorithmResults: allAlgorithmResults,
    selectedAlgorithm: bestResult.algorithmKey,
    routes: bestResult.routes,
    totalDistance: bestResult.totalDistance,
    totalDuration: bestResult.totalDuration,
  });

  const optimization = await newOptimization.save();
  const populated = await Optimization.findById(optimization._id)
    .populate('vehicles')
    .populate('locations');

  return res.json({
    ...populated.toObject(),
    isComparisonRun: true,
    bestAlgorithmKey: bestResult.algorithmKey,
    comparisonMetrics: allAlgorithmResults.map(a => ({
      algorithm: a.algorithm,
      totalDistance: a.totalDistance,
      totalDuration: a.totalDuration,
      avgDeliveryTime: a.avgDeliveryTimeMinutes,
      coverage: a.coveragePercentage,
      utilization: a.vehicleUtilization,
      onTimeRate: a.onTimeRate,
      executionTime: a.executionTime
    }))
  });
}


/**
 * Orchestrates a single algorithm run.
 */
async function runSingleAlgorithm(req, res, context) {
  const { name, user, vehicleIds, locationIds, algorithm, vehicles, locations, depot, algorithmMap, useTimeWindows } = context;
  const selectedAlgo = algorithmMap[algorithm] || algorithmMap['clarke-wright'];
  const algorithmOptions = { useTimeWindows };

  console.log(`--- STARTING SINGLE ALGORITHM RUN: ${selectedAlgo.name} ---`);

  try {
    const startTime = Date.now();
    const rawRoutes = await Promise.resolve(
      selectedAlgo.function(vehicles, locations, depot, algorithmOptions)
    );
    const executionTime = Date.now() - startTime;
    console.log(`[Single Run] SUCCESS: ${selectedAlgo.name} finished in ${executionTime}ms.`);

    const routesWithVehicles = assignVehiclesToRoutes(rawRoutes, vehicles);
   

    const metrics = calculateRouteMetrics(routesWithVehicles, locations, vehicles, depot._id);
    
    const result = {
      algorithm: selectedAlgo.name,
      algorithmKey: algorithm,
      routes: routesWithVehicles,
      executionTime,
      ...metrics
    };

    const newOptimization = new Optimization({
      name,
      user: user.id,
      vehicles: vehicleIds,
      locations: locationIds,
      algorithmResults: [result], // Store the single result in the array
      selectedAlgorithm: algorithm,
      routes: routesWithVehicles,
      totalDistance: metrics.totalDistance,
      totalDuration: metrics.totalDuration,
    });

    const optimization = await newOptimization.save();
    const populated = await Optimization.findById(optimization._id).populate('vehicles').populate('locations');
    // console.log(populated);
    
    res.json(populated);
  } catch (algoErr) {
    console.error(`[Single Run] FAILED: ${selectedAlgo.name} crashed. Error: ${algoErr.message}`);
    res.status(500).json({ msg: `Algorithm execution failed: ${algoErr.message}` });
  }
}


// ... (deleteOptimization, getRoutedPolyline, and other helpers remain the same) ...

/**
 * DELETE /api/optimizations/:id
 * Delete an optimization by its ID.
 */
exports.deleteOptimization = async (req, res) => {
  try {
    const optimization = await Optimization.findById(req.params.id);
    if (!optimization) {
      return res.status(404).json({ msg: 'Optimization not found' });
    }
    if (optimization.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    await Optimization.deleteOne({ _id: req.params.id });
    res.json({ msg: 'Optimization removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
function calculateRouteMetrics(routes, locations, vehicles, depotId, useTimeWindows = false) {
  let totalDistance = 0,
      totalDuration = 0,
      totalDemandServed = 0,
      totalStops = 0,
      totalServiceTime = 0,
      totalArrivalDelay = 0,
      onTimeDeliveries = 0;

  const servedLocationIds = new Set();

  routes.forEach(route => {
    totalDistance += route.distance || 0;
    totalDuration += route.duration || 0;
    totalDemandServed += route.totalCapacity || 0;
    totalStops += route.stops?.length ? route.stops.length - 2 : 0; // exclude depot start/end

    // calculate route-level service time stats
    route.stops?.forEach(stop => {
      if (stop.locationId && stop.locationId.toString() !== depotId.toString()) {
        servedLocationIds.add(stop.locationId.toString());
        totalServiceTime += stop.serviceTime || 0;

        // ✅ Time window metrics
        if (useTimeWindows && stop.requiredStartTime && stop.requiredEndTime) {
          const arrival = stop.arrivalTime || 0;
          if (arrival >= stop.requiredStartTime && arrival <= stop.requiredEndTime) {
            onTimeDeliveries++;
          } else if (arrival > stop.requiredEndTime) {
            totalArrivalDelay += arrival - stop.requiredEndTime;
          }
        }
      }
    });
  });

  const totalLocations = locations.filter(l => !l.isDepot).length;
  const totalVehicleCapacity = vehicles.reduce((sum, v) => sum + ((v.capacity || 0) * (v.count || 1)), 0);
  const servedCount = servedLocationIds.size;

  const avgStopsPerRoute = routes.length ? totalStops / routes.length : 0;
  const avgDurationPerRoute = routes.length ? totalDuration / routes.length : 0;
  const avgDistancePerRoute = routes.length ? totalDistance / routes.length : 0;
  const avgServiceTimePerStop = totalStops > 0 ? totalServiceTime / totalStops : 0;
  const avgDelayPerStop = totalStops > 0 ? totalArrivalDelay / totalStops : 0;
  const avgLoadUtilization = vehicles.length > 0 ? (totalDemandServed / totalVehicleCapacity) * 100 : 0;

  const onTimeRate = useTimeWindows && totalStops > 0 ? (onTimeDeliveries / totalStops) * 100 : null;

  return {
    totalDistance,
    totalDuration,
    totalDemandServed,
    totalLocationsServed: servedCount,
    coveragePercentage: totalLocations > 0 ? (servedCount / totalLocations) * 100 : 0,
    vehicleUtilization: avgLoadUtilization,
    routesCount: routes.length,
    avgStopsPerRoute,
    avgDurationPerRoute,
    avgDistancePerRoute,
    avgServiceTimePerStop,
    avgDelayPerStop,
    avgDeliveryTimeMinutes: avgServiceTimePerStop / 60,
    onTimeRate
  };
}

/**
 * GET /api/optimizations/:id/route/:routeIndex/polyline
 * Get a routed polyline for a specific route within an optimization.
 */
exports.getRoutedPolyline = async (req, res) => {
  try {
    const { id, routeIndex } = req.params;
    const optimization = await Optimization.findById(id);
    if (!optimization) return res.status(404).json({ msg: 'Optimization not found' });
    if (optimization.user.toString() !== req.user.id) return res.status(401).json({ msg: 'User not authorized' });
    
    const route = optimization.routes[Number(routeIndex)];
    if (!route) return res.status(404).json({ msg: 'Route not found' });

    const osrmData = await getOsrmRouteForStops(route.stops);
    res.json(osrmData);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// ================== HELPER FUNCTIONS FOR CONTROLLER ==================

/**
 * Calculates key performance metrics for a set of routes.
 */
// function calculateRouteMetrics(routes, locations, vehicles, depotId) {
//   let totalDistance = 0, totalDuration = 0, totalDemandServed = 0;
//   const servedLocationIds = new Set();

//   routes.forEach(route => {
//     totalDistance += route.distance || 0;
//     totalDuration += route.duration || 0;
//     totalDemandServed += route.totalCapacity || 0;
//     route.stops.forEach(stop => {
//       if (stop.locationId && stop.locationId.toString() !== depotId.toString()) {
//         servedLocationIds.add(stop.locationId.toString());
//       }
//     });
//   });

//   const totalLocations = locations.filter(l => !l.isDepot).length;
//   const totalVehicleCapacity = vehicles.reduce((sum, v) => sum + ((v.capacity || 0) * (v.count || 1)), 0);

//   return {
//     totalDistance,
//     totalDuration,
//     totalDemandServed,
//     totalLocationsServed: servedLocationIds.size,
//     coveragePercentage: totalLocations > 0 ? (servedLocationIds.size / totalLocations) * 100 : 0,
//     vehicleUtilization: totalVehicleCapacity > 0 ? (totalDemandServed / totalVehicleCapacity) * 100 : 0,
//     routesCount: routes.length,
//   };
// }

/**
 * Selects the best algorithm result based on coverage and then distance.
 */
function findBestResult(results) {
  const validResults = results.filter(r => !r.error && r.routes && r.routes.length > 0);
  if (validResults.length === 0) {
    return results[0] || { routes: [], totalDistance: 0, totalDuration: 0 };
  }

  const maxCoverage = Math.max(...validResults.map(r => r.coveragePercentage || 0));
  const bestCandidates = validResults.filter(r => r.coveragePercentage === maxCoverage);
  
  return bestCandidates.reduce((best, current) =>
    (current.totalDistance || Infinity) < (best.totalDistance || Infinity) ? current : best
  );
}