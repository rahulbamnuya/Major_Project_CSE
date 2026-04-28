const axios = require('axios');

/**
 * Calculates the Haversine distance between two coordinates in kilometers.
 */
exports.calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (
    typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
    isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)
  ) {
    return 0;
  }

  const toRad = (deg) => deg * Math.PI / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 1000) / 1000; // km rounded to 3 decimals
};

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '..', 'matrix_cache.json');

// Load cache from disk on startup
let matrixCache = new Map();
try {
  if (fs.existsSync(CACHE_FILE)) {
    const rawData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    
    // Migration: If the cache is in the old flat format, wrap it in the new structure
    Object.entries(rawData).forEach(([key, value]) => {
      if (value && value.distances && value.durations) {
        matrixCache.set(key, value);
      } else {
        // This is an old cache entry. Migrating...
        matrixCache.set(key, { 
          distances: value || {}, 
          durations: {} // Durations will be refetched on next run if empty
        });
      }
    });
    
    console.log(`📂 Loaded and migrated ${matrixCache.size} matrices from disk cache.`);
  }
} catch (err) {
  console.warn('⚠️ Could not load matrix cache from disk:', err.message);
}

const saveCacheToDisk = () => {
  try {
    const data = Object.fromEntries(matrixCache);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data), 'utf8');
  } catch (err) {
    console.warn('⚠️ Could not save matrix cache to disk:', err.message);
  }
};

/**
 * Fetches a real road distance matrix from OSRM.
 * Falls back to Haversine if service fails.
 */
exports.getDistanceMatrix = async (locations) => {
  const osrmKey = process.env.OSRM_API_KEY;
  const orsKey = process.env.ORS_API_KEY;

  // Create a unique key for this set of locations to check cache
  // Using location IDs and total count to ensure uniqueness
  const cacheKey = `matrix_${locations.length}_` + locations.map(l => l._id.toString()).sort().join('|');
  
  if (matrixCache.has(cacheKey)) {
    console.log('⚡ Using cached Distance Matrix (Disk/Memory).');
    return matrixCache.get(cacheKey);
  }

  try {
    console.log(`🌐 Fetching Road Distance Matrix for ${locations.length} points...`);
    const coords = locations.map(l => `${l.longitude},${l.latitude}`).join(';');
    
    // Default to public OSRM, but allow for an API key if provided via a custom service
    let url = `http://router.project-osrm.org/table/v1/driving/${coords}?annotations=distance,duration`;
    
    // If there's an ORS key, we could use OpenRouteService as a higher-quality alternative
    if (orsKey && !osrmKey) {
       // Note: OpenRouteService has different API structure, keeping OSRM for now
       // but we could implement ORS here if OSRM continues to fail.
    }

    // Increased timeout from 8s to 30s for better reliability
    const response = await axios.get(url, { timeout: 30000 });
    
    if (response.data && response.data.distances && response.data.durations) {
      console.log('✅ OSRM Road Matrix & Durations successfully fetched.');
      const matrix = { distances: {}, durations: {} };
      
      locations.forEach((l1, i) => {
        const id1 = l1._id.toString();
        matrix.distances[id1] = {};
        matrix.durations[id1] = {};
        
        locations.forEach((l2, j) => {
          const id2 = l2._id.toString();
          
          // Distance in KM
          const distMeters = response.data.distances[i][j];
          matrix.distances[id1][id2] = distMeters !== null ? distMeters / 1000 : exports.calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
          
          // Duration in Seconds (OSRM returns seconds)
          const durationSeconds = response.data.durations[i][j];
          matrix.durations[id1][id2] = durationSeconds !== null ? durationSeconds : ((matrix.distances[id1][id2] / 40) * 3600); // Fallback to 40km/h
        });
      });
      
      // Store in cache
      matrixCache.set(cacheKey, matrix);
      saveCacheToDisk(); // Persist to file
      return matrix;
    }
  } catch (error) {
    console.warn(`⚠️ OSRM Matrix failed (${error.message}). Falling back to Haversine math.`);
  }

  // Fallback: Build Haversine Matrix (both distance and estimated duration)
  const matrix = { distances: {}, durations: {} };
  locations.forEach((l1) => {
    const id1 = l1._id.toString();
    matrix.distances[id1] = {};
    matrix.durations[id1] = {};
    locations.forEach((l2) => {
      const id2 = l2._id.toString();
      const dist = exports.calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
      matrix.distances[id1][id2] = dist;
      matrix.durations[id1][id2] = (dist / 40) * 3600; // Estimated 40km/h
    });
  });
  return matrix;
};

/**
 * Calculates the total distance (cost) of a given solution.
 */
exports.calculateTotalCost = (solution, distances) => {
  const toIdLocal = (objId) => objId.toString();
  return solution.reduce((total, route) => {
    let routeCost = 0;
    for (let i = 0; i < route.stops.length - 1; i++) {
      const fromId = toIdLocal(route.stops[i].locationId);
      const toIdStr = toIdLocal(route.stops[i + 1].locationId);
      routeCost += distances.distances[fromId]?.[toIdStr] || 0;
    }
    return total + routeCost;
  }, 0);
};

/**
 * Assigns the best-fitting vehicles to a list of routes based on capacity.
 * Returns an object with assignedRoutes and unassignedStops.
 */
/**
 * Assigns the best-fitting vehicles to a list of routes based on capacity.
 * EXTREME ROBUSTNESS: Stacks any number of routes into multi-trips to prevent drops.
 */
exports.assignVehiclesToRoutes = (routes, vehicles) => {
  // 1. Sort routes by demand (descending) to handle bulkier loads first
  const sortedRoutes = [...routes].sort((a, b) => (b.totalCapacity || 0) - (a.totalCapacity || 0));
  
  // 2. Prepare fleet with numeric capacities and usage counters
  const fleet = vehicles.map(v => ({
    _id: v._id.toString(),
    name: v.name,
    capacity: Number(v.capacity || 0),
    vehicle_type: v.vehicle_type || 'LARGE',
    tripCount: 0,
    lastTripEndTime: 0
  })).sort((a, b) => b.capacity - a.capacity); // Largest first for primary assignment

  const MAX_TRIPS = 12; // Allow deep sequencing
  const assignedRoutes = [];
  const unassignedStops = [];

  console.log(`📡 Dispatcher: Assigning ${sortedRoutes.length} routes to ${fleet.length} vehicles...`);

  for (const route of sortedRoutes) {
    const demand = Number(route.totalCapacity || 0);
    
    // INFRASTRUCTURE AWARENESS: What is the strictest road in this route?
    let strictestRoadType = 'WIDE';
    route.stops.forEach(s => {
       const rt = (s.road_type || 'STANDARD').toUpperCase();
       if (rt === 'NARROW') strictestRoadType = 'NARROW';
       else if (rt === 'STANDARD' && strictestRoadType !== 'NARROW') strictestRoadType = 'STANDARD';
    });

    // Sort fleet to FIND the best vehicle for THIS route
    // Priority: 1. Fewest trips | 2. Infrastructure Compatibility | 3. Efficiency
    const availableFleet = fleet.filter(v => {
      // 1. Capacity Check
      if (v.capacity < demand) return false;
      
      // 2. Max Trip Check
      if (v.tripCount >= MAX_TRIPS) return false;

      // 3. INFRASTRUCTURE CHECK
      const vType = (v.vehicle_type || 'LARGE').toUpperCase();
      if (strictestRoadType === 'NARROW' && vType !== 'SMALL') return false;
      if (strictestRoadType === 'STANDARD' && vType === 'LARGE') return false;

      return true;
    });
    
    availableFleet.sort((a, b) => {
      // Rule 1: Always use a driver who hasn't started yet before giving anyone a 2nd trip
      if (a.tripCount !== b.tripCount) return a.tripCount - b.tripCount;
      // Rule 2: Use the smaller truck to save fuel
      return a.capacity - b.capacity;
    });

    const bestVehicle = availableFleet[0];

    if (bestVehicle) {
      bestVehicle.tripCount++;
      const vIdKey = bestVehicle._id;
      
      const assignedRoute = JSON.parse(JSON.stringify(route));
      assignedRoute.vehicle = vIdKey;
      assignedRoute.vehicle_type = bestVehicle.vehicle_type; // Pass type for UI audit
      assignedRoute.originalVehicleId = bestVehicle._id;
      
      let timeOffsetSeconds = 0;
      const RELOAD_BUFFER = 15 * 60;
      if (bestVehicle.lastTripEndTime > 0) {
        const defaultStart = assignedRoute.stops[0].departureTime || (6 * 3600);
        timeOffsetSeconds = Math.max(0, (bestVehicle.lastTripEndTime + RELOAD_BUFFER) - defaultStart);
      }

      assignedRoute.stops.forEach(stop => {
        if (stop.arrivalTime) stop.arrivalTime += timeOffsetSeconds;
        if (stop.departureTime) stop.departureTime += timeOffsetSeconds;
      });

      assignedRoute.vehicleName = `${bestVehicle.name}${bestVehicle.tripCount > 1 ? ` (Trip ${bestVehicle.tripCount})` : ''}`;
      bestVehicle.lastTripEndTime = assignedRoute.stops[assignedRoute.stops.length - 1].arrivalTime;
      
      assignedRoutes.push(assignedRoute);
      console.log(`✅ Dispatch: ${assignedRoute.vehicleName} assigned ${demand}kg (Ends: ${new Date(bestVehicle.lastTripEndTime * 1000).toISOString().substr(11,5)})`);
    } else {
      const customerStops = route.stops.filter((s, idx) => idx !== 0 && idx !== route.stops.length - 1);
      customerStops.forEach(s => {
        unassignedStops.push({
          locationId: s.locationId,
          locationName: s.locationName,
          reason: 'Oversized Load or Fleet Exhausted'
        });
      });
    }
  }

  return { assignedRoutes, unassignedStops };
};