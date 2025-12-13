import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import OptimizationService from '../services/optimization.service';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import QRCode from "react-qr-code";

// Helper to create a numbered icon
const createNumberedIcon = (number) => L.divIcon({
  html: `<div class="map-marker-number">${number}</div>`,
  className: 'map-marker-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

// Custom depot icon
const depotIcon = L.icon({
  iconUrl: "https://png.pngtree.com/element_our/20190529/ourmid/pngtree-flat-warehouse-image_1199036.jpg",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

// Helper to format seconds into HH:MM AM/PM
const formatTime = (seconds) => {
  if (seconds === null || seconds === undefined) return '--:--';
  const totalMinutes = Math.floor(seconds / 60);
  const h24 = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
};

// Helper to format total minutes into hours and minutes
const formatDuration = (totalMinutes) => {
  if (totalMinutes === null || totalMinutes === undefined || totalMinutes < 1) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  const parts = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes > 0) parts.push(`${minutes} min`);
  return parts.length > 0 ? parts.join(' ') : '0 min';
};

// Helper to generate Google Maps URL
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
  const [position, setPosition] = useState([22.7200, 75.8853]);

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
    document.body.classList.add('print-friendly');
    return () => document.body.classList.remove('print-friendly');
  }, []);
  
  // (Animation useEffect and handleToggleMap remain the same and are correct)

  const handleToggleMap = (route, idx) => {
    const isOpening = openMapIndex !== idx;
    if (isOpening) {
      const newPath = route.routeGeometry && route.routeGeometry.length > 0
        ? route.routeGeometry
        : route.stops.map(stop => [stop.latitude, stop.longitude]);
      setActiveRoutePath(newPath);
      setOpenMapIndex(idx);
      if (newPath.length > 0) setPosition(newPath[0]);
    } else {
      setOpenMapIndex(null);
      setActiveRoutePath([]);
    }
  };

  if (!optimization) return <div className="container mx-auto px-6 py-8">Loading...</div>;

  return (
    <>
      <style>{`
        .map-marker-number { background-color: #3b82f6; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
        .late { color: red; font-weight: bold; }
        .leaflet-div-icon { background: transparent; border: none; }
      `}</style>

      <div className="container mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Route Sheets: {optimization.name}</h1>
        <button className="btn btn-outline mb-6" onClick={() => window.print()}>Print</button>
        <div className="grid md:grid-cols-2 gap-6">
          {optimization.routes.map((route, idx) => {
            const assignedVehicle = optimization.vehicles.find(v => v._id === route.vehicle);
            const capacityUtilization = assignedVehicle && assignedVehicle.capacity > 0
              ? Math.min((route.totalCapacity / assignedVehicle.capacity) * 100, 100)
              : 0;

            return (
              <div key={idx} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-lg font-semibold">Vehicle: {route.vehicleName || `Route ${idx+1}`}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {route.stops.length} stops &bull; {route.distance.toFixed(2)} km &bull; {formatDuration(route.duration)}
                    </div>
                  </div>
                  <div className="p-2 bg-white rounded-lg">
                    <QRCode value={generateGoogleMapsUrl(route.stops)} size={80} />
                  </div>
                </div>

                {assignedVehicle && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center text-xs font-mono text-gray-500 dark:text-gray-400">
                      <span>Load Carried</span>
                      <span>{route.totalCapacity} / {assignedVehicle.capacity}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-1">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${capacityUtilization}%` }}></div>
                    </div>
                  </div>
                )}

                <div className="flex-grow min-h-[250px] mb-4">
                  {openMapIndex === idx ? (
                    <div className="rounded-lg overflow-hidden h-full w-full">
                      <MapContainer center={activeRoutePath.length > 0 ? activeRoutePath[0] : [22.7200, 75.8853]} zoom={12} style={{ height: "100%", width: "100%" }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Polyline positions={activeRoutePath} color="#3b82f6" weight={5} />
                        {route.stops.map((stop, stopIndex) => (
                           <Marker key={stopIndex} position={[stop.latitude, stop.longitude]} icon={stopIndex === 0 ? depotIcon : createNumberedIcon(stopIndex)}>
                            <Popup>
                              <b>{stopIndex === 0 ? 'Depot' : `Stop ${stopIndex}`}</b>: {stop.locationName}<br/>
                              {stopIndex > 0 && `Arrival: ${formatTime(stop.arrivalTime)}<br/>`}
                              {/* --- CORRECTED POPUP --- */}
                              {stop.serviceTime > 0 && `Service: ${Math.round(stop.serviceTime / 60)} min<br/>`}
                              {stopIndex > 0 && stopIndex < route.stops.length -1 && `Departure: ${formatTime(stop.arrivalTime + stop.serviceTime)}<br/>`}
                              Time Window: {formatTime(stop.timeWindowStart)} - {formatTime(stop.timeWindowEnd)}<br/>
                              {stop.arrivalTime && stop.timeWindowEnd && stop.arrivalTime > stop.timeWindowEnd ? <span className="late">Late!</span> : null}
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>
                  ) : (
                   <ol className="list-decimal pl-5 space-y-2 text-sm">
                      {/* ==================== THE KEY CORRECTION ==================== */}
                      {route.stops.map((stop, i) => {
                        const isDepotStart = i === 0;
                        const isDepotEnd = i === route.stops.length - 1;
                        const departureTime = stop.arrivalTime + stop.serviceTime;

                        let label = 'Arrival';
                        if (isDepotStart) label = 'Departure';
                        if (isDepotEnd) label = 'Return';

                        return (
                          <li key={i}>
                            <span className="font-semibold">{stop.locationName}</span> 
                            {stop.demand && !isDepotStart && !isDepotEnd ? ` (Demand: ${stop.demand})` : ''} <br/>
                            
                            {/* Detailed Itinerary Line */}
                            <span className="text-gray-600 dark:text-gray-400">
                              {label}: {formatTime(stop.arrivalTime)}
                              
                              {/* Show Service and Departure for customer stops */}
                              {!isDepotStart && !isDepotEnd && (
                                <>
                                  <span className="mx-1">|</span>
                                  Service: {Math.round(stop.serviceTime / 60)} min
                                  <span className="mx-1">|</span>
                                  Departure: {formatTime(departureTime)}
                                </>
                              )}
                            </span>
                            
                            {/* Late Indicator */}
                            {stop.arrivalTime && stop.timeWindowEnd && stop.arrivalTime > stop.timeWindowEnd 
                              ? <span className="late ml-2"> Late!</span> 
                              : null
                            }
                          </li>
                        );
                      })}
                      {/* ========================================================== */}
                    </ol>
                  )}
                </div>

                <button className="btn btn-sm btn-primary mt-auto" onClick={() => handleToggleMap(route, idx)}>
                  {openMapIndex === idx ? "Show Stop List" : "Show Map"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default RouteSheet;