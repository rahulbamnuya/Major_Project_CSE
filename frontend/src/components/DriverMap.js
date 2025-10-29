import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import io from 'socket.io-client';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icons (Leaflet issue in React)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function DriverMap() {
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    // Connect to backend server (change URL if deployed)
    const socket = io('http://localhost:5000');

    // Listen for driver location updates
    socket.on('locationUpdate', (data) => {
      // data = { driverId, lat, lng }
      setDrivers((prev) => {
        const existing = prev.filter((d) => d.driverId !== data.driverId);
        return [...existing, data];
      });
    });

    // Cleanup on unmount
    return () => socket.disconnect();
  }, []);

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <h2 style={{ textAlign: 'center', padding: '10px' }}>🚗 Live Driver Map</h2>

      <MapContainer
        center={[20.5937, 78.9629]} // Center of India
        zoom={5}
        style={{ height: '90vh', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Render each driver as a marker */}
        {drivers.map((driver, index) => (
          <Marker key={index} position={[driver.lat, driver.lng]}>
            <Popup>
              <b>Driver ID:</b> {driver.driverId} <br />
              Lat: {driver.lat.toFixed(4)} <br />
              Lng: {driver.lng.toFixed(4)}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
