import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import OptimizationService from '../services/optimization.service';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import QRCode from "react-qr-code";
import LoadingSkeleton from '../components/LoadingSkeleton';

// Helper to create a numbered icon
const createNumberedIcon = (number) => L.divIcon({
  html: `<div class="map-marker-number">${number}</div>`,
  className: 'map-marker-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

// Custom depot icon
const depotIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/2830/2830310.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const formatTime = (seconds) => {
  if (seconds === null || seconds === undefined) return '--:--';
  const totalMinutes = Math.floor(seconds / 60);
  const h24 = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const formatDuration = (totalMinutes) => {
  if (totalMinutes === null || totalMinutes === undefined || totalMinutes < 1) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const generateGoogleMapsUrl = (stops) => {
  if (!stops || stops.length < 2) return "https://maps.google.com";
  const waypoints = stops.slice(1, -1).map(s => `${s.latitude},${s.longitude}`).join('|');
  const origin = `${stops[0].latitude},${stops[0].longitude}`;
  const destination = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}`;
};

const RouteSheet = () => {
  const { id } = useParams();
  const [optimization, setOptimization] = useState(null);
  const [openMapIndex, setOpenMapIndex] = useState(null);
  const [activeRoutePath, setActiveRoutePath] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await OptimizationService.get(id);
        setOptimization(data);
      } catch (e) {
        console.error("Failed to fetch optimization data:", e);
      }
    })();
  }, [id]);

  useEffect(() => {
    document.body.classList.add('print-mode');
    return () => document.body.classList.remove('print-mode');
  }, []);

  const handleToggleMap = (route, idx) => {
    const isOpening = openMapIndex !== idx;
    if (isOpening) {
      const newPath = route.routeGeometry && route.routeGeometry.length > 0
        ? route.routeGeometry
        : route.stops.map(stop => [stop.latitude, stop.longitude]);
      setActiveRoutePath(newPath);
      setOpenMapIndex(idx);
    } else {
      setOpenMapIndex(null);
      setActiveRoutePath([]);
    }
  };

  if (!optimization) return <div className="container mx-auto px-6 py-8"><LoadingSkeleton lines={10} /></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans p-8">
      <style>{`
        .map-marker-number { background-color: #3b82f6; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
        .late { color: #dc2626; font-weight: 800; }
        .leaflet-div-icon { background: transparent; border: none; }
        
        @media print {
          @page { size: A4; margin: 1cm; }
          body * { visibility: hidden; }
          .route-sheet-container, .route-sheet-container * { visibility: visible; }
          .route-sheet-container { position: absolute; left: 0; top: 0; width: 100%; background: white; color: black; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          .bg-slate-50, .dark .bg-slate-900 { background: white !important; }
          .text-slate-900, .dark .text-slate-100 { color: black !important; }
          .border-gray-200, .dark .border-gray-800 { border-color: #ddd !important; }
          .shadow-sm { box-shadow: none !important; }
        }
      `}</style>

      <div className="route-sheet-container max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8 no-print">
          <div>
            <h1 className="text-3xl font-bold mb-2">Driver Manifests</h1>
            <p className="text-slate-500">{optimization.name} • {new Date(optimization.createdAt || optimization.date).toLocaleDateString()}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold shadow-lg transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>
              Print All Sheets
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {optimization.routes.map((route, idx) => {
            const assignedVehicle = optimization.vehicles.find(v => v._id === route.vehicle);
            return (
              <div key={idx} className={`bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-8 ${idx > 0 ? 'page-break' : ''}`}>
                {/* Header Section */}
                <div className="bg-slate-100 dark:bg-slate-800 p-6 border-b-2 border-slate-200 dark:border-slate-700 flex justify-between items-start">
                  <div>
                    <div className="uppercase tracking-wide text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Route Sheet #{idx + 1}</div>
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">{route.vehicleName}</h2>
                    <div className="flex gap-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1">📏 {route.distance.toFixed(1)} km</span>
                      <span className="flex items-center gap-1">⏱️ {formatDuration(route.duration)}</span>
                      <span className="flex items-center gap-1">📦 {route.stops.length} Stops</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                      <QRCode value={generateGoogleMapsUrl(route.stops)} size={90} />
                    </div>
                    <span className="text-[10px] font-mono mt-1 text-slate-500 uppercase tracking-widest">Scan for Nav</span>
                  </div>
                </div>

                {/* Itinerary Section */}
                <div className="p-0">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-3 px-6 font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                        <th className="py-3 px-6 font-bold text-slate-500 uppercase tracking-wider">Location / Address</th>
                        <th className="py-3 px-6 font-bold text-slate-500 uppercase tracking-wider w-24">Type</th>
                        <th className="py-3 px-6 font-bold text-slate-500 uppercase tracking-wider w-32">Time Window</th>
                        <th className="py-3 px-6 font-bold text-slate-500 uppercase tracking-wider w-32">Scheduled</th>
                        <th className="py-3 px-6 font-bold text-slate-500 uppercase tracking-wider w-20 text-right">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {route.stops.map((stop, i) => {
                        const isDepotStart = i === 0;
                        const isDepotEnd = i === route.stops.length - 1;
                        const isLate = stop.timeWindowEnd !== null && stop.arrivalTime > stop.timeWindowEnd * 60;

                        return (
                          <tr key={i} className={isLate ? "bg-red-50 dark:bg-red-900/10" : ""}>
                            <td className="py-4 px-6 font-bold text-slate-400">{i + 1}</td>
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-900 dark:text-white text-base">{stop.locationName}</div>
                              {stop.address && <div className="text-slate-500 text-xs mt-0.5 truncate max-w-[250px]">{stop.address}</div>}
                              {stop.demand > 0 && (
                                <span className="inline-block bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded mt-1">
                                  Package ID: #{1000 + i} • Qty: {stop.demand}
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              {isDepotStart ? <span className="font-bold text-slate-600 border border-slate-300 rounded px-2 py-0.5 text-xs">START</span> :
                                isDepotEnd ? <span className="font-bold text-slate-600 border border-slate-300 rounded px-2 py-0.5 text-xs">END</span> :
                                  <span className="font-bold text-blue-600 border border-blue-200 bg-blue-50 rounded px-2 py-0.5 text-xs">DROP</span>}
                            </td>
                            <td className="py-4 px-6 font-mono text-slate-600 dark:text-slate-400">
                              {stop.timeWindowStart !== null ? `${formatTime(stop.timeWindowStart * 60)} - ${formatTime(stop.timeWindowEnd * 60)}` : 'Anytime'}
                            </td>
                            <td className="py-4 px-6">
                              <div className={`font-mono font-bold ${isLate ? 'text-red-600' : 'text-slate-800 dark:text-white'}`}>
                                {isDepotStart ? 'Dep: ' : 'Arr: '}
                                {formatTime(stop.arrivalTime)}
                              </div>
                              {isLate && <div className="text-[10px] font-bold text-red-500 uppercase mt-1">⚠️ LATE ARRIVAL</div>}
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="h-6 w-full border-b border-slate-300"></div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer / Notes Area */}
                <div className="bg-slate-50 dark:bg-slate-800 p-6 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-8 break-inside-avoid">
                  <div>
                    <h4 className="font-bold text-slate-900 border-b border-slate-300 pb-2 mb-20 text-sm uppercase">Driver Signature</h4>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 border-b border-slate-300 pb-2 mb-20 text-sm uppercase">Dispatcher Signature</h4>
                  </div>
                </div>

                {/* Map Toggle (Screen Only) */}
                <div className="no-print p-4 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-center">
                  <button onClick={() => handleToggleMap(route, idx)} className="text-sm font-semibold text-blue-600 hover:underline">
                    {openMapIndex === idx ? "Hide Interactive Map" : "View Interactive Map"}
                  </button>
                </div>

                {openMapIndex === idx && (
                  <div className="h-[400px] w-full no-print">
                    <MapContainer center={activeRoutePath.length > 0 ? activeRoutePath[0] : [22.7200, 75.8853]} zoom={12} style={{ height: "100%", width: "100%" }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Polyline positions={activeRoutePath} color="#3b82f6" weight={5} />
                      {route.stops.map((stop, stopIndex) => (
                        <Marker key={stopIndex} position={[stop.latitude, stop.longitude]} icon={stopIndex === 0 ? depotIcon : createNumberedIcon(stopIndex)}>
                          <Popup>
                            <b>{stopIndex === 0 ? 'Depot' : `Stop ${stopIndex}`}</b>: {stop.locationName}
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};

export default RouteSheet;