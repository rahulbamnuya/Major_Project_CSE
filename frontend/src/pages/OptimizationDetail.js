import {React, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import OptimizationService from '../services/optimization.service';
import Map from '../components/Map';
import '../styles/OptimizationDetail.css';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../context/AuthContext';

// ================== FINAL HELPER FUNCTIONS (MERGED AND CORRECTED) ==================
/**
 * Converts seconds from midnight into a user-friendly "HH:MM AM/PM" format.
 */
const formatTime = (seconds) => {
  if (seconds === null || seconds === undefined) return '--:--';
  const totalMinutes = Math.floor(seconds / 60);
  const h24 = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
};

/**
 * Converts total minutes into a readable "X hours Y min" format.
 */
const formatDuration = (totalMinutes) => {
  if (!totalMinutes || totalMinutes < 1) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  const parts = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes > 0) parts.push(`${minutes} min`);
  return parts.join(' ');
};
// =======================================================================================

// ================== FINAL, ENHANCED TIMELINE COMPONENT (MERGED) ==================
/**
 * A dedicated component to render the detailed timeline for a single route.
 * It now displays service time, departure time, the required time window, and a "LATE" indicator.
 */
const RouteTimeline = ({ route }) => {
  return (
    <div className="route-timeline">
      <h4>Itinerary</h4>
      <ul className="timeline-list">
        {route.stops.map((stop, index) => {
          const isDepotStart = index === 0;
          const isDepotEnd = index === route.stops.length - 1;
          const departureTime = stop.arrivalTime + stop.serviceTime;

          let label = 'Arrival';
          if (isDepotStart) label = 'Departure';
          if (isDepotEnd) label = 'Return';

          // --- KEY LOGIC: Check if the arrival is outside the required window ---
          // Backend provides timeWindowEnd in MINUTES, so convert to SECONDS for comparison.
          const isLate = stop.timeWindowEnd !== null && stop.arrivalTime > stop.timeWindowEnd * 60;

          return (
            <li key={index} className={`timeline-item ${isDepotStart || isDepotEnd ? 'depot' : ''}`}>
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <span className="location-name">{stop.locationName}</span>
                  {stop.demand > 0 && <span className="chip demand-chip">Demand: {stop.demand}</span>}
                  {isLate && <span className="chip late-chip">LATE</span>}
                </div>
                <div className="timeline-times">
                  <span className="time-label">{label}: </span>
                  <span className={`time-value ${isLate ? 'late-text' : ''}`}>{formatTime(stop.arrivalTime)}</span>
                  
                  {!isDepotStart && !isDepotEnd && (
                    <>
                      <span className="time-separator">|</span>
                      <span className="time-label">Service: </span>
                      <span className="time-value">{Math.round(stop.serviceTime / 60)} min</span>
                      <span className="time-separator">|</span>
                      <span className="time-label">Departure: </span>
                      <span className="time-value">{formatTime(departureTime)}</span>
                    </>
                  )}
                </div>
                {/* --- Displays the Time Window information --- */}
                {!isDepotStart && !isDepotEnd && stop.timeWindowStart !== null && (
                  <div className="timeline-window">
                    <i className="fas fa-clock"></i>
                    <span>
                      Required Window: {formatTime(stop.timeWindowStart * 60)} - {formatTime(stop.timeWindowEnd * 60)}
                    </span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
// ===========================================================================================

const OptimizationDetail = () => {
  const { id } = useParams();
  const [optimization, setOptimization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('routes');
  const { notify } = useToast();
  const { currentUser } = useAuth();
  const [useRoadNetwork, setUseRoadNetwork] = useState(false);
  const [routedPolylines, setRoutedPolylines] = useState({});

  // (All useEffect hooks and handler functions from your old code are correct and remain)
  useEffect(() => {
    fetchOptimization();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (useRoadNetwork && optimization?.routes) {
      (async () => {
        const map = {};
        let successCount = 0;
        let fallbackCount = 0;
        for (let i = 0; i < optimization.routes.length; i++) {
          try {
            const data = await OptimizationService.getRoutedPolyline(id, i);
            map[i] = data.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            if (data.fallback) fallbackCount++;
            else successCount++;
          } catch (e) {
            console.error('Failed to fetch routed polyline for route', i, e);
            fallbackCount++;
          }
        }
        setRoutedPolylines(map);
        if (successCount > 0 && fallbackCount === 0) notify(`Real road routes loaded for all ${successCount} routes`, 'success', { autoClose: 2000 });
        else if (successCount > 0) notify(`Real road routes loaded (${successCount} routes), ${fallbackCount} using straight lines`, 'info', { autoClose: 3000 });
        else notify('Using straight-line routes (road network unavailable)', 'warning', { autoClose: 2000 });
      })();
    }
  }, [useRoadNetwork, optimization, id, notify]);

  useEffect(() => {
    if (currentUser?.preferences?.preferRoadNetwork) {
      setUseRoadNetwork(true);
    }
  }, [currentUser]);

  const fetchOptimization = async () => {
    try {
      setLoading(true);
      const response = await OptimizationService.get(id);
      setOptimization(response);
      setError('');
      notify('Optimization loaded', 'success', { autoClose: 1200 });
    } catch (err){
      setError('Failed to load optimization details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!optimization) return;
    try {
      const dataStr = JSON.stringify(optimization, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `optimization-${optimization.name.replace(/\s+/g, '-').toLowerCase()}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      notify('Optimization exported', 'success');
    } catch (e) {
      notify('Export failed', 'error');
    }
  };

  if (loading) {
    return (
      <div className="optimization-detail-container">
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  if (!optimization) {
    return (
      <div className="optimization-detail-container">
        <div className="alert alert-danger">{error || 'Optimization not found'}</div>
        <Link to="/optimizations" className="btn btn-primary">Back to Optimizations</Link>
      </div>
    );
  }

  return (
    <div className="optimization-detail-container container mx-auto px-6 py-8">
      {/* (All JSX for Header, Summary, Analytics, and Map is correct and remains) */}
      <div className="optimization-header">
        <div>
          <h1>{optimization.name}</h1>
          <p className="optimization-date">
            <i className="fas fa-calendar"></i>{' '}
            {new Date(optimization.createdAt || optimization.date).toLocaleDateString()}
          </p>
        </div>
        <div className="optimization-actions">
          <button className="btn btn-secondary rounded-lg px-4 py-2" onClick={handleExport}><i className="fas fa-download"></i> Export JSON</button>
          <Link to={`/optimizations/${optimization._id}/compare`} className="btn btn-info rounded-lg px-4 py-2">
            <i className="fas fa-chart-bar"></i> Compare Algorithms
            {optimization.algorithmResults && optimization.algorithmResults.length > 1 && (<span className="comparison-badge">{optimization.algorithmResults.length}</span>)}
          </Link>
          <Link to={`/optimizations/${optimization._id}/print`} className="btn btn-outline rounded-lg px-4 py-2"><i className="fas fa-print"></i> Print Route Sheets</Link>
          <Link to="/optimizations" className="btn btn-primary rounded-lg px-4 py-2">Back to List</Link>
        </div>
      </div>
      <div className="optimization-summary">
        <div className="summary-card" data-aos="fade-up"><div className="summary-icon"><i className="fas fa-route"></i></div><div className="summary-content"><h3>Routes</h3><p className="summary-value">{optimization.routes.length}</p></div></div>
        <div className="summary-card" data-aos="fade-up" data-aos-delay="50"><div className="summary-icon"><i className="fas fa-cogs"></i></div><div className="summary-content"><h3>Algorithm</h3><p className="summary-value">{optimization.selectedAlgorithm ? optimization.selectedAlgorithm.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Clarke Wright'}</p></div></div>
        <div className="summary-card" data-aos="fade-up" data-aos-delay="100"><div className="summary-icon"><i className="fas fa-road"></i></div><div className="summary-content"><h3>Total Distance</h3><p className="summary-value">{Number(optimization?.totalDistance ?? 0).toFixed(2)} km</p></div></div>
        <div className="summary-card" data-aos="fade-up" data-aos-delay="150"><div className="summary-icon"><i className="fas fa-truck"></i></div><div className="summary-content"><h3>Utilization</h3><p className="summary-value">{`${new Set((optimization.routes || []).map(r => r.vehicle).filter(Boolean)).size}/${(optimization.vehicles || []).length || 1} vehicles used`}</p></div></div>
      </div>
      <div className="analytics-section mt-6 grid md:grid-cols-4 gap-4" data-aos="fade-up">
        {(() => {
          const routes = optimization.routes || [];
          const totalStops = routes.reduce((s, r) => s + (r.stops?.length || 0), 0);
          const totalLoad = routes.reduce((sum, route) => sum + (route.totalCapacity || 0), 0);
          const totalCapacity = routes.reduce((sum, route) => sum + (optimization.vehicles?.find(v => v._id === route.vehicle)?.capacity || 0), 0);
          const loadEfficiency = totalCapacity > 0 ? ((totalLoad / totalCapacity) * 100) : 0;
          const usedVehicles = new Set(routes.map(r => r.vehicle).filter(Boolean)).size;
          const totalVehicles = optimization.vehicles?.length || 0;
          const vehicleUtilization = totalVehicles > 0 ? ((usedVehicles / totalVehicles) * 100) : 0;
          const avgDistance = routes.length ? (routes.reduce((sum, r) => sum + Number(r.distance || 0), 0) / routes.length) : 0;
          return (
            <>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"><div className="text-sm text-gray-600 dark:text-gray-400">Total Stops</div><div className="text-2xl font-bold">{totalStops}</div></div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"><div className="text-sm text-gray-600 dark:text-gray-400">Load Efficiency</div><div className="text-2xl font-bold text-green-600">{loadEfficiency.toFixed(1)}%</div><div className="text-xs text-gray-500">{totalLoad}/{totalCapacity} units</div></div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"><div className="text-sm text-gray-600 dark:text-gray-400">Vehicle Utilization</div><div className="text-2xl font-bold text-blue-600">{vehicleUtilization.toFixed(1)}%</div><div className="text-xs text-gray-500">{usedVehicles}/{totalVehicles} vehicles</div></div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"><div className="text-sm text-gray-600 dark:text-gray-400">Avg Distance/Route</div><div className="text-2xl font-bold">{avgDistance.toFixed(2)} km</div></div>
            </>
          );
        })()}
      </div>
      <div className="map-wrapper" data-aos="fade-up">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={useRoadNetwork} onChange={() => setUseRoadNetwork(v => !v)} />
          <span>Use road network (beta)</span>
        </label>
      </div>
      <Map
        locations={optimization.locations || []}
        routes={optimization.routes || []}
        vehicles={optimization.vehicles || []}
        useRoadNetwork={useRoadNetwork}
        routedPolylines={routedPolylines}
        optimizationId={optimization._id}
        onRoutedPolylinesUpdate={(routeIndex, coordinates) => {
          setRoutedPolylines(prev => ({
            ...prev,
            [routeIndex]: coordinates
          }));
        }}
        center={optimization.locations && optimization.locations.length > 0
          ? [optimization.locations[0].latitude, optimization.locations[0].longitude]
          : [22.7196, 75.8577]
        }
        zoom={13}
        height="700px"
      />
    </div>

      <div className="optimization-tabs" data-aos="fade-up">
        <div className="tabs-header">
          <button className={`tab-button ${activeTab === 'routes' ? 'active' : ''}`} onClick={() => setActiveTab('routes')}>Routes</button>
          <button className={`tab-button ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>Details</button>
        </div>
        
        <div className="tabs-content">
          {activeTab === 'routes' && (
            <div className="routes-tab">
              {optimization.routes && optimization.routes.map((route, index) => {
                const hasTimeData = route.stops && route.stops.length > 0 && typeof route.stops[0].arrivalTime !== 'undefined';
                return (
                  <div key={index} className="route-card rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
                    <h3>Route {index + 1} - {route.vehicleName}</h3>
                    <div className="chips">
                      <span className="chip"><i className="fa fa-road"></i> {Number(route.distance || 0).toFixed(2)} km</span>
                      <span className="chip"><i className="fa fa-clock"></i> {formatDuration(route.duration)}</span>
                      <span className="chip"><i className="fa fa-box"></i> {route.totalCapacity} units</span>
                    </div>
                    {hasTimeData ? (
                      // Renders the new, correct timeline
                      <RouteTimeline route={route} />
                    ) : (
                      // Fallback for older data without time info
                      <div className="route-stops">
                        <h4>Stops</h4>
                        <ol className="stops-list">
                          {route.stops.map((stop, stopIndex) => (
                            <li key={stopIndex}>
                              <span>{stop.locationName}</span>
                              <span>
                                {stop.demand > 0 && <span className="chip stop-chip">Demand: {stop.demand}</span>}
                                {stopIndex === 0 || stopIndex === route.stops.length - 1 ? (<span className="badge stop-chip">Depot</span>) : null}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {activeTab === 'details' && (
          <div className="details-tab">
            <div className="details-section">
              <h3>Optimization Details</h3>
              <table className="details-table">
                <tbody>
                  <tr>
                    <td>Name</td>
                    <td>{optimization.name}</td>
                  </tr>
                  <tr>
                    <td>Date</td>
                    {/* CORRECTED: Use `createdAt` from timestamps */}
                    <td>{new Date(optimization.createdAt).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td>Total Routes</td>
                    <td>{optimization.routes.length}</td>
                  </tr>
                  <tr>
                    <td>Total Distance</td>
                    <td>{Number(optimization.totalDistance || 0).toFixed(2)} km</td>
                  </tr>
                  <tr>
                    <td>Total Stops</td>
                    <td>
                      {optimization.routes.reduce(
                        (total, route) => total + route.stops.length,
                        0
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default OptimizationDetail;