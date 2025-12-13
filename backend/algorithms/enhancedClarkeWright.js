const { calculateDistance } = require('../utils/optimizationUtils');
const { enhancedLocalSearch } = require('./localSearch');

// exports.enhancedClarkeWrightAlgorithm = (vehicles, locations, depot) => {
//     console.log("Running Enhanced Clarke-Wright Algorithm...");
//     // ... Paste the entire logic of the enhancedClarkeWrightAlgorithm here
//     return routes;
// };
exports.enhancedClarkeWrightAlgorithm =(vehicles, locations, depot) =>{
  console.log("4")
 const speedKmh = 40;
 const toId = (objId) => objId.toString();

 // Build distance matrix
 const distances = {};
 const allIds = locations.map((l) => toId(l._id));
 locations.forEach((l1) => {
   const id1 = toId(l1._id);
   distances[id1] = {};
   locations.forEach((l2) => {
     const id2 = toId(l2._id);
     distances[id1][id2] = calculateDistance(
       l1.latitude, l1.longitude, l2.latitude, l2.longitude
     );
   });
 });

 const depotId = toId(depot._id);
 const nonDepot = locations.filter((l) => toId(l._id) !== depotId);

 // Enhanced savings calculation with multiple advanced components
 const savings = [];
 for (let i = 0; i < nonDepot.length; i++) {
   for (let j = i + 1; j < nonDepot.length; j++) {
     const li = nonDepot[i];
     const lj = nonDepot[j];
     const idI = toId(li._id);
     const idJ = toId(lj._id);

     const basicSaving = distances[depotId][idI] + distances[depotId][idJ] - distances[idI][idJ];

     // Angular component for better route continuity
     const angleI = Math.atan2(li.latitude - depot.latitude, li.longitude - depot.longitude);
     const angleJ = Math.atan2(lj.latitude - depot.latitude, lj.longitude - depot.longitude);
     const angularDiff = Math.abs(angleI - angleJ);
     const angularBonus = Math.min(angularDiff, 2 * Math.PI - angularDiff) / Math.PI;

     // Capacity compatibility bonus
     const demandI = li.demand || 0;
     const demandJ = lj.demand || 0;
     const combinedDemand = demandI + demandJ;
     const maxVehicleCapacity = vehicles.length > 0 ? Math.max(...vehicles.map(v => v.capacity || 0)) : Infinity;
     const capacityCompatibility = combinedDemand <= maxVehicleCapacity ? 1 : Math.max(0.1, maxVehicleCapacity / combinedDemand);

     // Service time consideration (estimated based on demand)
     const serviceTimeI = Math.max(5, demandI * 2); // Minimum 5 minutes, 2 minutes per unit demand
     const serviceTimeJ = Math.max(5, demandJ * 2);
     const combinedServiceTime = serviceTimeI + serviceTimeJ;

     // Time window compatibility (placeholder for future implementation)
     const timeCompatibility = 1; // Would be calculated based on time windows if available

     // Urgency factor based on demand size (higher demand = higher priority)
     const urgencyFactor = Math.min(1.2, 1 + (combinedDemand / maxVehicleCapacity) * 0.2);

     // Distance efficiency bonus (prefer closer pairs)
     const distanceEfficiency = Math.max(0.8, 1 - (distances[idI][idJ] / 50)); // Bonus for pairs within 50km

     // Enhanced saving with multiple factors
     const enhancedSaving = basicSaving *
       (1 + angularBonus * 0.15) *           // Angular continuity
       capacityCompatibility *                // Capacity feasibility
       urgencyFactor *                       // Demand priority
       distanceEfficiency *                  // Distance efficiency
       timeCompatibility;                    // Time compatibility

     savings.push({
       i: li,
       j: lj,
       saving: enhancedSaving,
       basicSaving,
       angularBonus,
       capacityCompatibility,
       combinedDemand,
       urgencyFactor,
       distanceEfficiency,
       serviceTime: combinedServiceTime
     });
   }
 }
 savings.sort((a, b) => b.saving - a.saving);

 // Initialize routes
 const makeDepotStop = (order) => ({
   locationId: depot._id,
   locationName: depot.name,
   latitude: depot.latitude,
   longitude: depot.longitude,
   demand: depot.demand || 0,
   order
 });

 const routes = nonDepot.map((loc) => {
   const stops = [
     makeDepotStop(0),
     {
       locationId: loc._id,
       locationName: loc.name,
       latitude: loc.latitude,
       longitude: loc.longitude,
       demand: loc.demand || 0,
       order: 1
     },
     makeDepotStop(2)
   ];
   const distance = distances[depotId][toId(loc._id)] * 2;
   return {
     vehicle: undefined,
     vehicleName: 'Unassigned',
     stops,
     distance,
     duration: Math.round((distance / speedKmh) * 60),
     totalCapacity: loc.demand || 0
   };
 });

 const maxCapacity = vehicles.length > 0 ? Math.max(...vehicles.map((v) => v.capacity || 0)) : 0;

 const findRouteIndexByLocation = (idStr) => {
   for (let r = 0; r < routes.length; r++) {
     const rt = routes[r];
     const foundIdx = rt.stops.findIndex((s) => toId(s.locationId) === idStr);
     if (foundIdx !== -1) {
       return { routeIndex: r, stopIndex: foundIdx };
     }
   }
   return null;
 };

 const isStartEndpoint = (rt, idx) => idx === 1;
 const isEndEndpoint = (rt, idx) => idx === rt.stops.length - 2;

 const recomputeRouteMetrics = (rt) => {
   let dist = 0;
   for (let k = 0; k < rt.stops.length - 1; k++) {
     const from = rt.stops[k];
     const to = rt.stops[k + 1];
     const fromId = toId(from.locationId);
     const toIdStr = toId(to.locationId);
     dist += distances[fromId]?.[toIdStr] ?? calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
   }
   rt.distance = dist;
   rt.duration = Math.round((dist / speedKmh) * 60);
 };

 // Enhanced merging with capacity consideration
 for (const s of savings) {
   const idI = toId(s.i._id);
   const idJ = toId(s.j._id);

   const posI = findRouteIndexByLocation(idI);
   const posJ = findRouteIndexByLocation(idJ);
   if (!posI || !posJ || posI.routeIndex === posJ.routeIndex) continue;

   const r1 = routes[posI.routeIndex];
   const r2 = routes[posJ.routeIndex];

   const iAtEndOfR1 = isEndEndpoint(r1, posI.stopIndex);
   const iAtStartOfR1 = isStartEndpoint(r1, posI.stopIndex);
   const jAtEndOfR2 = isEndEndpoint(r2, posJ.stopIndex);
   const jAtStartOfR2 = isStartEndpoint(r2, posJ.stopIndex);

   let newStops = null;

   if (iAtEndOfR1 && jAtStartOfR2) {
     newStops = [...r1.stops.slice(0, -1), ...r2.stops.slice(1)];
   } else if (jAtEndOfR2 && iAtStartOfR1) {
     newStops = [...r2.stops.slice(0, -1), ...r1.stops.slice(1)];
   }

   if (!newStops) continue;

   const combinedDemand = (r1.totalCapacity || 0) + (r2.totalCapacity || 0);
   if (combinedDemand > maxCapacity) continue;

   newStops = newStops.map((st, idx) => ({ ...st, order: idx }));
   const merged = {
     vehicle: undefined,
     vehicleName: 'Unassigned',
     stops: newStops,
     distance: 0,
     duration: 0,
     totalCapacity: combinedDemand
   };
   recomputeRouteMetrics(merged);

   const idxToRemove = Math.max(posI.routeIndex, posJ.routeIndex);
   const idxToReplace = Math.min(posI.routeIndex, posJ.routeIndex);
   routes.splice(idxToRemove, 1);
   routes.splice(idxToReplace, 1, merged);
 }

 // Advanced vehicle assignment with load balancing
 const vehicleSlots = [];
 vehicles.forEach((v) => {
   const count = v.count || 1;
   for (let i = 0; i < count; i++) {
     vehicleSlots.push({
       _id: v._id,
       name: v.name,
       capacity: v.capacity || 0,
       used: false,
       currentLoad: 0
     });
   }
 });

 // Sort routes by demand descending, vehicles by capacity descending
 routes.sort((a, b) => (b.totalCapacity || 0) - (a.totalCapacity || 0));
 vehicleSlots.sort((a, b) => b.capacity - a.capacity);

 // Best-fit assignment
 for (const route of routes) {
   const bestSlot = vehicleSlots
     .filter(vs => !vs.used && vs.capacity >= (route.totalCapacity || 0))
     .sort((a, b) => (a.capacity - (a.currentLoad + (route.totalCapacity || 0))) -
                     (b.capacity - (b.currentLoad + (route.totalCapacity || 0))))[0];

   if (bestSlot) {
     route.vehicle = bestSlot._id;
     route.vehicleName = bestSlot.name;
     bestSlot.used = true;
     bestSlot.currentLoad += route.totalCapacity || 0;
   }
 }

 // Advanced local search with multiple techniques
 routes.forEach((route) => {
   enhancedLocalSearch(route, distances, speedKmh);
 });

 return routes;
}