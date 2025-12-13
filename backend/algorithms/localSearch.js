// /algorithms/localSearch.js
const { calculateDistance } = require('../utils/optimizationUtils');
// exports.improveRouteWithLocalSearch = (route, distances, speedKmh) => {
//     // ... logic from original file
// };

exports.improveRouteWithLocalSearch=(route, distances, speedKmh) =>{
  // Extract non-depot stops
  console.log("2")
  if (!route.stops || route.stops.length < 3) return;
  const first = route.stops[0];
  const last = route.stops[route.stops.length - 1];
  const middle = route.stops.slice(1, -1);

  const toId = (x) => x.locationId.toString();
  const calcDist = (seq) => {
    let d = 0;
    for (let i = 0; i < seq.length - 1; i++) {
      const a = seq[i];
      const b = seq[i + 1];
      const ai = toId(a);
      const bi = toId(b);
      d += distances[ai]?.[bi] ?? calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude);
    }
    return d;
  };

  // 2-opt improvement
  let improved = true;
  let seq = [first, ...middle, last];
  while (improved) {
    improved = false;
    for (let i = 1; i < seq.length - 2; i++) {
      for (let k = i + 1; k < seq.length - 1; k++) {
        const newSeq = [...seq.slice(0, i), ...seq.slice(i, k + 1).reverse(), ...seq.slice(k + 1)];
        if (calcDist(newSeq) + 1e-9 < calcDist(seq)) {
          seq = newSeq;
          improved = true;
        }
      }
    }
  }

  // 3-opt limited improvement (simple swap of three segments)
  const threeOptOnce = () => {
    for (let i = 1; i < seq.length - 3; i++) {
      for (let j = i + 1; j < seq.length - 2; j++) {
        for (let k = j + 1; k < seq.length - 1; k++) {
          const A = seq.slice(0, i);
          const B = seq.slice(i, j);
          const C = seq.slice(j, k);
          const D = seq.slice(k);
          const candidates = [
            [...A, ...B, ...C, ...D], // original
            [...A, ...B.reverse(), ...C, ...D],
            [...A, ...B, ...C.reverse(), ...D],
            [...A, ...C, ...B, ...D],
            [...A, ...C.reverse(), ...B, ...D],
            [...A, ...B.reverse(), ...C.reverse(), ...D],
          ];
          const base = calcDist(seq);
          let best = seq;
          let bestD = base;
          for (const cand of candidates) {
            const d = calcDist(cand);
            if (d + 1e-9 < bestD) {
              bestD = d;
              best = cand;
            }
          }
          if (best !== seq) {
            seq = best;
            return true;
          }
        }
      }
    }
    return false;
  };

  if (threeOptOnce()) {
    // run a brief 2-opt again
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 1; i < seq.length - 2; i++) {
        for (let k = i + 1; k < seq.length - 1; k++) {
          const newSeq = [...seq.slice(0, i), ...seq.slice(i, k + 1).reverse(), ...seq.slice(k + 1)];
          if (calcDist(newSeq) + 1e-9 < calcDist(seq)) {
            seq = newSeq;
            changed = true;
          }
        }
      }
    }
  }

  // Rebuild route
  route.stops = seq.map((s, idx) => ({ ...s, order: idx }));
  // Recompute metrics
  let totalDistance = 0;
  for (let i = 0; i < route.stops.length - 1; i++) {
    const a = route.stops[i];
    const b = route.stops[i + 1];
    const ai = toId(a);
    const bi = toId(b);
    totalDistance += distances[ai]?.[bi] ?? calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude);
  }
  route.distance = totalDistance;
  route.duration = Math.round((totalDistance / speedKmh) * 60);
}

// exports.enhancedLocalSearch = (route, distances, speedKmh) => {
//     // ... logic from original file
// };
exports.enhancedLocalSearch=(route, distances, speedKmh) =>{
 if (!route.stops || route.stops.length < 4) return;

 const toId = (x) => x.locationId.toString();
 const calcDist = (seq) => {
   let d = 0;
   for (let i = 0; i < seq.length - 1; i++) {
     const a = seq[i];
     const b = seq[i + 1];
     const ai = toId(a);
     const bi = toId(b);
     d += distances[ai]?.[bi] ?? calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude);
   }
   return d;
 };

 const first = route.stops[0];
 const last = route.stops[route.stops.length - 1];
 let middle = route.stops.slice(1, -1);

 // 2-opt improvement
 let improved = true;
 let seq = [first, ...middle, last];
 while (improved) {
   improved = false;
   for (let i = 1; i < seq.length - 2; i++) {
     for (let k = i + 1; k < seq.length - 1; k++) {
       const newSeq = [...seq.slice(0, i), ...seq.slice(i, k + 1).reverse(), ...seq.slice(k + 1)];
       if (calcDist(newSeq) + 1e-9 < calcDist(seq)) {
         seq = newSeq;
         improved = true;
       }
     }
   }
 }

 // Or-opt: move segments of 1-2-3 consecutive cities
 for (let length = 1; length <= 3; length++) {
   for (let i = 1; i < seq.length - length - 1; i++) {
     const segment = seq.slice(i, i + length);
     const remaining = [...seq.slice(0, i), ...seq.slice(i + length)];

     for (let j = 1; j < remaining.length; j++) {
       const newSeq = [
         ...remaining.slice(0, j),
         ...segment,
         ...remaining.slice(j)
       ];

       if (calcDist(newSeq) + 1e-9 < calcDist(seq)) {
         seq = newSeq;
       }
     }
   }
 }

 // Update route
 route.stops = seq.map((s, idx) => ({ ...s, order: idx }));

 // Recompute metrics
 let totalDistance = 0;
 for (let i = 0; i < route.stops.length - 1; i++) {
   const a = route.stops[i];
   const b = route.stops[i + 1];
   const ai = toId(a);
   const bi = toId(b);
   totalDistance += distances[ai]?.[bi] ?? calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude);
 }
 route.distance = totalDistance;
 route.duration = Math.round((totalDistance / speedKmh) * 60);
}