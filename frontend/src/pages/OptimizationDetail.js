import { React, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import OptimizationService from '../services/optimization.service';
import Map from '../components/Map';
import '../styles/OptimizationDetail.css';
import { CardSkeleton, MapSkeleton, StatsCardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../context/AuthContext';
import {
  FaCalendarAlt, FaDownload, FaChartBar, FaPrint, FaArrowLeft,
  FaRoute, FaCogs, FaRoad, FaTruck, FaClock, FaBox, FaMapMarkerAlt,
  FaCheckCircle, FaExclamationTriangle
} from 'react-icons/fa';

// ================== HELPER FUNCTIONS ==================
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
  if (!totalMinutes || totalMinutes < 1) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  const parts = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hr' : 'hrs'}`);
  if (minutes > 0) parts.push(`${minutes} min`);
  return parts.join(' ');
};

// ================== COMPONENTS ==================
const RouteTimeline = ({ route }) => {
  return (
    <div className="mt-4 pl-2">
      <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 text-sm uppercase tracking-wider">Itinerary</h4>
      <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-6 pb-2">
        {route.stops.map((stop, index) => {
          const isDepotStart = index === 0;
          const isDepotEnd = index === route.stops.length - 1;
          const departureTime = stop.arrivalTime + stop.serviceTime;

          let label = 'Arrival';
          if (isDepotStart) label = 'Departure';
          if (isDepotEnd) label = 'Return';

          // Backend provides timeWindowEnd in MINUTES, convert to SECONDS
          const isLate = stop.timeWindowEnd !== null && stop.arrivalTime > stop.timeWindowEnd * 60;

          return (
            <div key={index} className="relative pl-6">
              {/* Dot Marker */}
              <div
                className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${isDepotStart || isDepotEnd ? 'bg-slate-800 dark:bg-slate-200' : isLate ? 'bg-red-500' : 'bg-blue-500'
                  }`}
              ></div>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                  <div className="font-bold text-slate-800 dark:text-slate-100 text-base">
                    {stop.locationName}
                  </div>
                  <div className="flex gap-2">
                    {stop.demand > 0 && (
                      <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                        {stop.demand} units
                      </span>
                    )}
                    {isLate && (
                      <span className="text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <FaExclamationTriangle /> LATE
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-xs text-slate-400 block uppercase">Time</span>
                    <span className={`font-mono font-medium ${isLate ? 'text-red-500' : ''}`}>{label}: {formatTime(stop.arrivalTime)}</span>
                  </div>

                  {!isDepotStart && !isDepotEnd && (
                    <>
                      <div>
                        <span className="text-xs text-slate-400 block uppercase">Service</span>
                        <span className="font-mono">{Math.round(stop.serviceTime / 60)} min</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block uppercase">Depart</span>
                        <span className="font-mono">{formatTime(departureTime)}</span>
                      </div>
                    </>
                  )}

                  {!isDepotStart && !isDepotEnd && stop.timeWindowStart !== null && (
                    <div className="col-span-2 md:col-span-1">
                      <span className="text-xs text-slate-400 block uppercase">Window</span>
                      <span className="font-mono text-xs">
                        {formatTime(stop.timeWindowStart * 60)} - {formatTime(stop.timeWindowEnd * 60)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


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
    } catch (err) {
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
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
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
      <div className="container mx-auto px-6 py-8 space-y-6">
        <StatsCardSkeleton />
        <MapSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!optimization) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Optimization Not Found</h2>
          <Link to="/optimizations" className="btn btn-primary">Back to Optimizations</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 md:pb-8 font-sans text-slate-800 dark:text-slate-100">
      <div className="container mx-auto px-4 md:px-8 py-8 md:py-10 max-w-7xl">

        {/* Header */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 anim-fade-up">
          <div>
            <Link to="/optimizations" className="text-slate-500 hover:text-blue-600 mb-2 inline-flex items-center gap-2 group transition-colors">
              <FaArrowLeft className="text-xs group-hover:-translate-x-1 transition-transform" /> Back to History
            </Link>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">{optimization.name}</h1>
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                <FaCalendarAlt className="text-blue-500" /> {new Date(optimization.createdAt || optimization.date).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                <FaCheckCircle className="text-green-500" /> Completed
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={handleExport} className="btn bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm rounded-xl px-4 py-2.5 flex items-center gap-2 transition-all">
              <FaDownload /> Export
            </button>
            <Link to={`/optimizations/${optimization._id}/compare`} className="btn bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-100 dark:border-indigo-800 shadow-sm rounded-xl px-4 py-2.5 flex items-center gap-2 transition-all">
              <FaChartBar /> Compare Items
              {optimization.algorithmResults && optimization.algorithmResults.length > 1 && (
                <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">{optimization.algorithmResults.length}</span>
              )}
            </Link>
            <Link to={`/optimizations/${optimization._id}/print`} className="btn bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm rounded-xl px-4 py-2.5 flex items-center gap-2 transition-all">
              <FaPrint /> Sheets
            </Link>
          </div>
        </div>

        {/* Summary Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center text-xl">
              <FaRoute />
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Routes</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{optimization.routes.length}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-xl flex items-center justify-center text-xl">
              <FaCogs />
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Algorithm</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white capitalize">
                {optimization.selectedAlgorithm ? optimization.selectedAlgorithm.replace(/-/g, ' ') : 'Clarke Wright'}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-xl flex items-center justify-center text-xl">
              <FaRoad />
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Distance</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{Number(optimization?.totalDistance ?? 0).toFixed(2)} km</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-xl flex items-center justify-center text-xl">
              <FaTruck />
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Utilization</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {new Set((optimization.routes || []).map(r => r.vehicle).filter(Boolean)).size} / {optimization.vehicles?.length || 0} Veh
              </p>
            </div>
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {(() => {
            const routes = optimization.routes || [];
            const totalStops = routes.reduce((s, r) => s + (r.stops?.length || 0), 0);
            const totalLoad = routes.reduce((sum, route) => sum + (route.totalCapacity || 0), 0);
            const totalCapacity = routes.reduce((sum, route) => sum + (optimization.vehicles?.find(v => v._id === route.vehicle)?.capacity || 0), 0);
            const loadEfficiency = totalCapacity > 0 ? ((totalLoad / totalCapacity) * 100) : 0;
            const avgDistance = routes.length ? (routes.reduce((sum, r) => sum + Number(r.distance || 0), 0) / routes.length) : 0;

            return (
              <>
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-500 text-transform uppercase">Total Stops</div>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{totalStops}</div>
                </div>
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-500 text-transform uppercase">Load Efficiency</div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">{loadEfficiency.toFixed(1)}%</div>
                  <div className="text-xs text-slate-400">{totalLoad}/{totalCapacity} units</div>
                </div>
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-500 text-transform uppercase">Avg Dist/Route</div>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{avgDistance.toFixed(1)} km</div>
                </div>
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-500 text-transform uppercase">Status</div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">Optimized</div>
                </div>
              </>
            )
          })()}
        </div>

        {/* Main Map */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden mb-10">
          <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white">Route Visualization</h3>
            <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm text-sm hover:bg-slate-50 transition-colors">
              <input type="checkbox" className="accent-blue-600" checked={useRoadNetwork} onChange={() => setUseRoadNetwork(v => !v)} />
              <span className="text-slate-700 dark:text-slate-200 font-medium">Use road network (Beta)</span>
            </label>
          </div>
          <div className="h-[600px] w-full relative z-0">
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
            />
          </div>
        </div>

        {/* Tabs for Routes/Details */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[500px]">
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              className={`flex-1 py-4 text-center font-bold text-sm uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'routes' ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              onClick={() => setActiveTab('routes')}
            >
              Detailed Routes
            </button>
            <button
              className={`flex-1 py-4 text-center font-bold text-sm uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'details' ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              onClick={() => setActiveTab('details')}
            >
              Technical Details
            </button>
          </div>

          <div className="p-6 md:p-8 bg-slate-50/30 dark:bg-slate-900/30">
            {activeTab === 'routes' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {optimization.routes && optimization.routes.map((route, index) => {
                  const hasTimeData = route.stops && route.stops.length > 0 && typeof route.stops[0].arrivalTime !== 'undefined';
                  const colorClass = ['border-blue-500', 'border-green-500', 'border-purple-500', 'border-orange-500'][index % 4];

                  return (
                    <div key={index} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className={`p-4 border-l-4 ${colorClass} bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center`}>
                        <h3 className="font-bold text-slate-800 dark:text-white">Route {index + 1} - {route.vehicleName}</h3>
                        <span className="text-xs font-mono bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                          {Number(route.distance).toFixed(1)} km
                        </span>
                      </div>
                      <div className="p-6">
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 flex items-center gap-1"><FaRoad /> {Number(route.distance).toFixed(2)} km</span>
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 flex items-center gap-1"><FaClock /> {formatDuration(route.duration)}</span>
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 flex items-center gap-1"><FaBox /> {route.totalCapacity} units</span>
                        </div>

                        {hasTimeData ? (
                          <RouteTimeline route={route} />
                        ) : (
                          <div className="space-y-4 relative pl-4 border-l-2 border-slate-200 dark:border-slate-700 ml-2 mt-4">
                            {route.stops.map((stop, stopIndex) => (
                              <div key={stopIndex} className="relative pl-6">
                                <div className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full ${stopIndex === 0 || stopIndex === route.stops.length - 1 ? 'bg-slate-800' : 'bg-blue-400'}`}></div>
                                <p className="font-medium text-slate-800 text-sm">{stop.locationName}</p>
                                {stop.demand > 0 && <span className="text-xs text-slate-500">Demand: {stop.demand}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'details' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden max-w-3xl mx-auto">
                <table className="w-full text-left border-collapse">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-4 font-medium text-slate-500 w-1/3">Optimization Name</td>
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{optimization.name}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-4 font-medium text-slate-500">Created At</td>
                      <td className="p-4 text-slate-800 dark:text-slate-200">{new Date(optimization.createdAt).toLocaleString()}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-4 font-medium text-slate-500">Total Routes</td>
                      <td className="p-4 text-slate-800 dark:text-slate-200">{optimization.routes.length}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-4 font-medium text-slate-500">Total Distance</td>
                      <td className="p-4 text-slate-800 dark:text-slate-200">{Number(optimization.totalDistance || 0).toFixed(2)} km</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-4 font-medium text-slate-500">Algorithm Used</td>
                      <td className="p-4 text-slate-800 dark:text-slate-200 capitalize">{optimization.selectedAlgorithm}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default OptimizationDetail;