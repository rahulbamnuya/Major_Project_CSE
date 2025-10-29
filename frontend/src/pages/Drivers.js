import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDrivers();
  }, []);

  async function fetchDrivers() {
    try {
      setLoading(true);
      const res = await axios.get('/api/drivers');
      setDrivers(res.data);
    } catch (err) {
      console.error('Fetch drivers error', err);
      alert('Could not load drivers');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this driver?')) return;
    try {
      await axios.delete(`/api/drivers/${id}`);
      setDrivers(prev => prev.filter(d => d._id !== id));
    } catch (err) {
      console.error('Delete error', err);
      alert('Could not delete driver');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2>Drivers</h2>
        <div>
          <button onClick={() => navigate('/drivers/add')} style={{ marginRight: 8 }}>+ Add Driver</button>
          <button onClick={fetchDrivers}>Refresh</button>
        </div>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : drivers.length === 0 ? (
        <div>No drivers yet. Click "Add Driver" to create one.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Driver ID</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Phone</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Address</th>
              <th style={{ textAlign: 'left', padding: 8 }}>License</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map(d => (
              <tr key={d._id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{d.driverId}</td>
                <td style={{ padding: 8 }}>{d.name}</td>
                <td style={{ padding: 8 }}>{d.phone}</td>
                <td style={{ padding: 8 }}>{d.address}</td>
                <td style={{ padding: 8 }}>{d.licenseNumber || '—'}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>
                  <button onClick={() => navigate(`/drivers/edit/${d._id}`)} style={{ marginRight: 8 }}>Edit</button>
                  <button onClick={() => handleDelete(d._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
