import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function DriverSimulator() {
  const [serverUrl, setServerUrl] = useState('http://localhost:5000'); // change if your backend is elsewhere
  const [driverId, setDriverId] = useState('SIM_DRIVER_1');
  const [lat, setLat] = useState(19.0760); // default start (Mumbai)
  const [lng, setLng] = useState(72.8777);
  const [intervalMs, setIntervalMs] = useState(2000);
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const socketRef = useRef(null);
  const tickRef = useRef(null);

  // Connect socket when serverUrl changes (but don't auto-start sending)
  useEffect(() => {
    // clean up existing socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const s = io(serverUrl, { transports: ['websocket', 'polling'] });

    s.on('connect', () => {
      setConnected(true);
      console.log('Simulator socket connected', s.id);
    });
    s.on('disconnect', () => {
      setConnected(false);
      console.log('Simulator socket disconnected');
    });
    s.on('connect_error', (err) => {
      setConnected(false);
      console.warn('connect_error', err.message);
    });

    socketRef.current = s;

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [serverUrl]);

  // random-walk step
  function stepPosition() {
    // small random change in degrees (~ up to ~10-20 meters)
    const dLat = (Math.random() - 0.5) * 0.0005;
    const dLng = (Math.random() - 0.5) * 0.0005;
    setLat(prev => parseFloat((prev + dLat).toFixed(6)));
    setLng(prev => parseFloat((prev + dLng).toFixed(6)));
  }

  // send one location ping
  function sendPing() {
    if (!socketRef.current || !socketRef.current.connected) return;
    const payload = {
      driverId,
      lat,
      lng,
      timestamp: Date.now()
    };
    socketRef.current.emit('driverLocation', payload);
    setSentCount(c => c + 1);
  }

  // start sending loop
  function start() {
    if (!socketRef.current || !socketRef.current.connected) {
      alert('Socket not connected. Check server URL and that backend is running.');
      return;
    }
    if (running) return;
    setRunning(true);
    // send immediately, then schedule
    sendPing();
    tickRef.current = setInterval(() => {
      // mutate position slightly then send
      stepPosition();
      sendPing();
    }, intervalMs);
  }

  // stop sending loop
  function stop() {
    setRunning(false);
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 18, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>Driver Simulator</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label>Backend Socket URL</label>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
          <small>Example: http://localhost:5000</small>
        </div>

        <div>
          <label>Driver ID</label>
          <input
            type="text"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
          <small>Any unique string for the driver</small>
        </div>

        <div>
          <label>Start Latitude</label>
          <input
            type="number"
            step="0.000001"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value))}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </div>

        <div>
          <label>Start Longitude</label>
          <input
            type="number"
            step="0.000001"
            value={lng}
            onChange={(e) => setLng(parseFloat(e.target.value))}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </div>

        <div>
          <label>Interval (ms)</label>
          <input
            type="number"
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
            min={200}
          />
          <small>How often to send location (ms)</small>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          {!running ? (
            <button onClick={start} style={{ padding: '10px 16px' }}>▶ Start</button>
          ) : (
            <button onClick={stop} style={{ padding: '10px 16px' }}>■ Stop</button>
          )}
          <button onClick={() => { setLat(19.0760); setLng(72.8777); }} style={{ padding: '10px 12px' }}>
            Reset to Mumbai
          </button>
          <button onClick={() => { setSentCount(0); }} style={{ padding: '10px 12px' }}>
            Reset Count
          </button>
        </div>
      </div>

      <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 6, marginBottom: 12 }}>
        <strong>Socket status:</strong> {connected ? <span style={{ color: 'green' }}>Connected</span> : <span style={{ color: 'red' }}>Disconnected</span>}
        <br />
        <strong>Running:</strong> {running ? 'Yes' : 'No'} &nbsp; | &nbsp;
        <strong>Sent pings:</strong> {sentCount}
        <br />
        <strong>Current Position:</strong> {lat.toFixed(6)}, {lng.toFixed(6)}
      </div>

      <div style={{ padding: 12, border: '1px dashed #ddd', borderRadius: 6 }}>
        <h3>How to test</h3>
        <ol>
          <li>Make sure backend is running (Socket.IO on <code>server.listen(...)</code>).</li>
          <li>Open this page (e.g. <code>/driver-sim</code> if you mount route there).</li>
          <li>Set the backend URL (default <code>http://localhost:5000</code>), a driver ID, and press <strong>Start</strong>.</li>
          <li>Open your Dispatcher Map (<code>/drivers</code>) — you should see that the backend broadcasts updates to clients (your map should listen for the same socket event name).</li>
        </ol>
        <p>
          If your dispatcher map listens for <code>'locationUpdate'</code> (object of driver positions) or <code>'updateDriverLocation'</code>, adjust the backend or the map to match the same event name.
        </p>
      </div>
    </div>
  );
}
