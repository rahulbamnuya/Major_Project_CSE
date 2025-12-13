// /utils/osrmUtils.js
const { calculateDistance } = require('./optimizationUtils');

// Calculate straight-line distance for fallback
function calculateStraightLineDistance(stops) {
  let totalDistance = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    totalDistance += calculateDistance(stops[i].latitude, stops[i].longitude, stops[i + 1].latitude, stops[i + 1].longitude);
  }
  return totalDistance;
}

/**
 * Get routed polyline and metrics from OSRM for a sequence of stops.
 */
exports.getOsrmRouteForStops = async (stops) => {
  const base = 'https://router.project-osrm.org/route/v1/driving/';
  const coords = stops.map(s => `${s.longitude},${s.latitude}`).join(';');
  const url = `${base}${coords}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`OSRM request failed: ${res.status}`);

    const data = await res.json();
    if (!data.routes || !data.routes.length) throw new Error('No routes in OSRM response');

    const route = data.routes[0];
    return {
      geometry: route.geometry,
      distanceKm: (route.distance || 0) / 1000,
      durationMin: Math.round((route.duration || 0) / 60)
    };
  } catch (e) {
    console.error('OSRM error:', e.message);
    // Fallback to a straight-line route
    return {
      geometry: {
        type: 'LineString',
        coordinates: stops.map(s => [s.longitude, s.latitude])
      },
      distanceKm: calculateStraightLineDistance(stops),
      durationMin: Math.round((calculateStraightLineDistance(stops) / 40) * 60),
      fallback: true
    };
  }
};