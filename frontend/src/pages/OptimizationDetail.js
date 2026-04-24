import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import OptimizationService from '../services/optimization.service';
import MapComponent from '../components/Map';
import '../styles/OptimizationDetail.css';
import { CardSkeleton, MapSkeleton, StatsCardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  FaCalendarAlt, FaDownload, FaChartBar, FaPrint, FaArrowLeft,
  FaRoute, FaTruck, FaClock, FaBox, FaRoad, 
  FaCheckCircle, FaExclamationTriangle, FaUserTie, FaCogs
} from 'react-icons/fa';

// ================== HELPER FUNCTIONS ==================
const formatDistance = (d) => `${Number(d || 0).toFixed(2)} km`;


const formatTime = (seconds) => {
  if (seconds === null || seconds === undefined) return '--:--';
  const totalMinutes = Math.floor(seconds / 60);
  const h24 = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const formatDuration = (minutes) => {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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
          const status = stop.status || 'Pending';

          const rType = (stop.road_type || 'STANDARD').toUpperCase();
          const goalTime = stop.endTimeWindowSeconds ?? stop.timeWindowEnd ?? stop.goalTime;
          const isLate = goalTime !== null && goalTime !== undefined && stop.arrivalTime > goalTime;

          return (
            <div key={index} className="relative pl-6">
              {/* Dot Marker with Live Status */}
              <div
                className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${status === 'Delivered' ? 'bg-green-500' :
                  status === 'En Route' ? 'bg-yellow-400 animate-pulse' :
                    isDepotStart || isDepotEnd ? 'bg-slate-800 dark:bg-slate-200' : isLate ? 'bg-red-500' : 'bg-blue-500'
                  }`}
              ></div>

              <div className={`bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border transition-colors ${status === 'Delivered' ? 'border-green-200 dark:border-green-900/30' :
                status === 'En Route' ? 'border-yellow-200 dark:border-yellow-900/30' :
                  'border-slate-100 dark:border-slate-700'
                }`}>
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-lg">
                      {stop.locationName}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                            rType === 'NARROW' ? 'bg-red-100 text-red-700 border-red-200' : 
                            rType === 'WIDE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                            'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                            {rType} Road
                        </span>
                        {status !== 'Pending' && (
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                                {status}
                            </span>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    {stop.demand > 0 && (
                      <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                        {stop.demand} units
                      </span>
                    )}
                    {!isDepotStart && !isDepotEnd && (
                      <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                        Service: {Math.round(stop.serviceTime / 60)}m Dwell
                      </span>
                    )}
                    {isLate && (
                      <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <FaExclamationTriangle className="text-[10px]" /> LATE
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700/50 pt-4">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1">Arrival</span>
                    <span className={`font-mono font-black text-base ${isLate ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                      {formatTime(stop.arrivalTime)}
                    </span>
                  </div>

                  {!isDepotStart && !isDepotEnd ? (
                    <>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1">Departure</span>
                        <span className="font-mono font-black text-base text-slate-900 dark:text-white">
                          {formatTime(departureTime)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-blue-500 block uppercase font-black mb-1 flex items-center gap-1">
                          <FaClock className="text-xs" /> Goal Window
                        </span>
                        <span className="font-mono text-xs font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 inline-block">
                          {(() => {
                            const start = stop.startTimeWindowSeconds ?? stop.timeWindowStart;
                            const end = stop.endTimeWindowSeconds ?? stop.timeWindowEnd ?? stop.goalTime;
                            return (start != null && end != null) 
                              ? `${formatTime(start)} - ${formatTime(end)}`
                              : 'Unrestricted';
                          })()}
                        </span>
                      </div>
                    </>
                  ) : <div></div>}
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
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const { notify } = useToast();
  const { currentUser } = useAuth();
  const [useRoadNetwork, setUseRoadNetwork] = useState(false);
  const [routedPolylines, setRoutedPolylines] = useState({});
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(-1);

  useEffect(() => {
    const init = async () => {
      // Show loading only on first load
      if (!optimization) setLoading(true);
      try {
        const [optData, drvData] = await Promise.all([
          OptimizationService.get(id),
          api.get('/drivers').then(r => r.data).catch(() => [])
        ]);
        setOptimization(optData);
        setDrivers(drvData);
      } catch (err) {
        // Only set error if we don't have data yet
        if (!optimization) notify('Failed to load optimization data', 'error');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();

    // Live Polling every 15 seconds
    const intervalId = setInterval(() => {
      // Silent refresh
      OptimizationService.get(id).then(optData => {
        setOptimization(optData);
      }).catch(err => console.error("Polling error:", err));
    }, 15000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, notify]); 

  useEffect(() => {
    if (useRoadNetwork && optimization?.routes) {
      (async function fetchPolylines() {
        const map = { ...routedPolylines };
        let updated = false;
        for (let i = 0; i < optimization.routes.length; i++) {
          if (!map[i]) {
            try {
              const data = await OptimizationService.getRoutedPolyline(id, i);
              if (data?.geometry?.coordinates) {
                map[i] = data.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                updated = true;
              }
            } catch (e) {
              console.error(`Route ${i} error:`, e);
            }
          }
        }
        if (updated) {
          setRoutedPolylines(map);
          notify('Road routes loaded', 'success', { autoClose: 1000 });
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useRoadNetwork, id, notify, optimization?.routes]); 

  useEffect(() => {
    if (currentUser?.preferences?.preferRoadNetwork) {
      setUseRoadNetwork(true);
    }
  }, [currentUser]);

  const handleDriverAssign = async (routeIndex, driverId) => {
    try {
      const updatedOpt = await OptimizationService.assignDriver(id, routeIndex, driverId);
      setOptimization(prev => ({
        ...prev,
        routes: updatedOpt.routes // assume server returns updated optimization
      }));
      notify('Driver assigned successfully', 'success');
    } catch (err) {
      notify('Failed to assign driver', 'error');
    }
  };

  const activeResult = useMemo(() => {
    if (!optimization) return null;
    const base = selectedResultIndex === -1 ? optimization : (optimization.algorithmResults?.[selectedResultIndex] || optimization);
    
    // Inject sustainability metrics
    const dist = base.totalDistance || 0;
    // 🚩 Aggregate Infrastructure & Time Violations
    let totalViolations = 0;
    let timeViolations = 0;
    base.routes?.forEach(route => {
        const v = optimization.vehicles?.find(veh => veh._id === route.vehicle || veh._id.toString() === route.vehicle);
        const vType = (v?.vehicle_type || 'LARGE').toUpperCase();
        
        // Use pre-calculated violation count if available, otherwise fallback to local calculation
        timeViolations += (route.timeViolationCount || 0);

        route.stops?.forEach(stop => {
            const rType = (stop.road_type || 'STANDARD').toUpperCase();
            if (rType === 'NARROW' && vType !== 'SMALL') totalViolations++;
            if (rType === 'STANDARD' && vType === 'LARGE') totalViolations++;
        });
    });

    return {
      ...base,
      totalCO2: dist * 0.16,
      co2Saved: dist * 0.05,
      geoViolations: totalViolations,
      timeViolations: timeViolations,
      isInfrastructureAware: true
    };
  }, [optimization, selectedResultIndex]);
  
  const mapCenter = useMemo(() => {
    if (optimization?.locations?.length > 0) {
        return [optimization.locations[0].latitude, optimization.locations[0].longitude];
    }
    return [22.7196, 75.8577]; // Default Indore
  }, [optimization?.locations]);

  // Unique results for the switcher to avoid "3x Geo-VRP" repetitions
  const uniqueResults = useMemo(() => {
    if (!optimization?.algorithmResults) return [];
    
    const uniqueMap = new Map();
    const geoVariants = [];
    
    optimization.algorithmResults.forEach(r => {
        if (r.algorithmKey?.includes('or-tools') || r.algorithmKey?.includes('hybrid') || r.algorithm?.includes('Advanced Geo-VRP')) {
            geoVariants.push(r);
        } else {
            // Dedupe others by name
            if (!uniqueMap.has(r.algorithm)) uniqueMap.set(r.algorithm, r);
        }
    });

    if (geoVariants.length > 0) {
        // Keep the best one or the one with routes (performance score isn't pre-calculated here, so use totalDistance/totalCapacity)
        const bestGeo = geoVariants[0]; // Simple selection for now as detail view usually has the intended one
        uniqueMap.set('Advanced Geo-VRP Hybrid', bestGeo);
    }

    return Array.from(uniqueMap.values());
  }, [optimization?.algorithmResults]);

  const handleExport = () => {
    if (!activeResult) return;
    try {
      const dataStr = JSON.stringify(activeResult, null, 2);
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
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
              {optimization.name}
              {activeResult?.isInfrastructureAware ? (
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-200 uppercase tracking-widest font-black flex items-center gap-1">
                  <FaCheckCircle className="text-[8px]" /> Deep Compliance
                </span>
              ) : (
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg border border-slate-200 uppercase tracking-widest font-black">
                  Baseline Logic
                </span>
              )}
            </h1>
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                <FaCalendarAlt className="text-blue-500" /> {new Date(optimization.createdAt || optimization.date).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                <FaCheckCircle className="text-green-500" /> Completed
              </span>

            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">


            <button onClick={handleExport} className="btn bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm rounded-xl px-4 py-2.5 flex items-center gap-2 transition-all">
              <FaDownload />
            </button>
            <Link to={`/optimizations/${optimization._id}/compare`} className="btn bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-100 dark:border-indigo-800 shadow-sm rounded-xl px-4 py-2.5 flex items-center gap-2 transition-all">
              <FaChartBar /> Compare
            </Link>
            <Link to={`/optimizations/${optimization._id}/print`} className="btn bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm rounded-xl px-4 py-2.5 flex items-center gap-2 transition-all">
              <FaPrint /> Sheets
            </Link>
          </div>
        </div>

        {/* Unassigned Warning Section */}
        {optimization.droppedNodes && optimization.droppedNodes.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-start gap-4 anim-fade-up">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl flex items-center justify-center text-xl shrink-0">
              <FaExclamationTriangle />
            </div>
            <div className="flex-1">
              <h3 className="text-amber-800 dark:text-amber-400 font-bold text-lg mb-1">Unassigned Stops Detected ({optimization.droppedNodes.length})</h3>
              <p className="text-amber-700/80 dark:text-amber-400/70 text-sm mb-3">
                Some locations could not be optimized into any route. This usually happens due to impossible time windows, vehicle capacity limits, or road restrictions.
              </p>
              <div className="flex flex-wrap gap-2">
                {optimization.droppedNodes.map((node, i) => (
                  <span key={i} className="bg-white/60 dark:bg-slate-800/40 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-lg text-xs font-bold text-amber-900 dark:text-amber-200">
                    {optimization.locations?.find(l => l._id === node.index || l.index === node.index)?.name || `Point ${node.index}`}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-amber-100 dark:bg-amber-900/50 px-4 py-2 rounded-xl text-amber-900 dark:text-amber-200 font-bold text-xs uppercase tracking-wider h-fit">
              Requires Attention
            </div>
          </div>
        )}

        {/* Summary Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8 anim-fade-up">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl flex items-center justify-center text-lg">
              <FaCogs />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Solving Strategy</p>
              <p className="text-base font-bold text-slate-900 dark:text-white truncate" title={activeResult?.algorithm}>
                {activeResult?.algorithm || 'Standard Heuristic'}
              </p>
              <p className="text-[9px] font-black text-indigo-500 uppercase mt-0.5">
                Time Windows: {activeResult.routes?.[0]?.timeWindowApplied ? 'ENABLED' : 'DISABLED'}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center text-lg">
              <FaRoute />
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Distance</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{formatDistance(activeResult?.totalDistance)}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-xl flex items-center justify-center text-lg">
              <FaClock />
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Time</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {activeResult?.totalDuration ? formatDuration(activeResult.totalDuration) : 'N/A'}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl flex items-center justify-center text-lg">
              <FaCheckCircle />
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Fulfillment</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {activeResult.totalStops || (activeResult.routes?.reduce((acc, r) => acc + (r.stops?.length || 0), 0) - (activeResult.routes?.length * 2))} / {optimization.locations.length - 1}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-xl flex items-center justify-center text-lg">
              <FaTruck />
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Asset Deployment</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {(() => {
                    const physicalVehicles = new Set();
                    activeResult.routes?.forEach(r => {
                        if (r.vehicle) physicalVehicles.add(r.vehicle.toString().split('_T')[0]);
                    });
                    return `${physicalVehicles.size} Vehicles (${activeResult.routes?.length || 0} Trips)`;
                })()}
              </p>
            </div>
          </div>

          <div className={`${activeResult.geoViolations > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/40' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/40'} p-5 rounded-2xl border shadow-sm flex items-center gap-4`}>
            <div className={`w-10 h-10 ${activeResult.geoViolations > 0 ? 'bg-red-500' : 'bg-emerald-500'} text-white rounded-xl flex items-center justify-center text-lg`}>
              <FaExclamationTriangle />
            </div>
            <div>
              <p className={`${activeResult.geoViolations > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} text-[10px] font-bold uppercase tracking-wider`}>Geo-Compliance</p>
              <p className={`text-lg font-bold ${activeResult.geoViolations > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {activeResult.geoViolations > 0 ? `${activeResult.geoViolations} Violations` : '100% Safe'}
              </p>
            </div>
          </div>

          <div className={`${activeResult.timeViolations > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/40' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/40'} p-5 rounded-2xl border shadow-sm flex items-center gap-4`}>
            <div className={`w-10 h-10 ${activeResult.timeViolations > 0 ? 'bg-amber-500' : 'bg-emerald-500'} text-white rounded-xl flex items-center justify-center text-lg`}>
              <FaClock />
            </div>
            <div>
              <p className={`${activeResult.timeViolations > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'} text-[10px] font-bold uppercase tracking-wider`}>Time Compliance</p>
              <p className={`text-lg font-bold ${activeResult.timeViolations > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {activeResult.timeViolations > 0 ? `${activeResult.timeViolations} Lates` : 'On-Time'}
              </p>
            </div>
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {(() => {
            const routes = activeResult.routes || [];
            const depotId = optimization.locations.find(l => l.isDepot)?._id?.toString();
            let deliveryStopsServed = 0;
            routes.forEach(r => {
                r.stops?.forEach(s => {
                    if (s.locationId?.toString() !== depotId) deliveryStopsServed++;
                });
            });

            const totalStops = deliveryStopsServed;
            const totalLoad = routes.reduce((sum, route) => sum + (route.totalCapacity || 0), 0);
            const totalCapacity = routes.reduce((sum, route) => sum + (optimization.vehicles?.find(v => v._id === route.vehicle || v._id.toString() === route.vehicle)?.capacity || 0), 0);
            const loadEfficiency = totalCapacity > 0 ? ((totalLoad / totalCapacity) * 100) : 0;
            const avgDistance = routes.length ? (routes.reduce((sum, r) => sum + Number(r.distance || 0), 0) / routes.length) : 0;

            return (
              <>
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-500 text-transform uppercase">Load Efficiency</div>
                  <div className={`text-xl font-bold ${loadEfficiency > 100 ? 'text-red-600 animate-pulse' : 'text-green-600 dark:text-green-400'}`}>
                    {loadEfficiency.toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-400">{totalLoad}/{totalCapacity} units</div>
                </div>
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-500 text-transform uppercase">Avg Dist/Route</div>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{avgDistance.toFixed(1)} km</div>
                </div>
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-500 text-transform uppercase">Real Ops. Cost</div>
                  <div className="text-xl font-bold text-green-700 dark:text-green-400">
                    {(() => {
                        // Priority 1: Use pre-calculated backend cost (handles multi-trip deduplication)
                        if (activeResult.totalCost) return `₹${Number(activeResult.totalCost).toFixed(2)}`;
                        
                        // Priority 2: Fallback logic (refined for multi-trip)
                        const getFixedCost = (capacity) => {
                            if (capacity <= 1000) return 250;
                            if (capacity <= 4000) return 450;
                            return 700;
                        };
                        const variableCost = activeResult.totalCost || 0; 
                        let fixedCost = 0;
                        
                        // Deduplicate vehicles by stripping _T1, _T2 suffixes to avoid double-charging multi-trips
                        const physicalVehicles = new Set();
                        (activeResult.routes || []).forEach(r => {
                            if (r.vehicle) physicalVehicles.add(r.vehicle.toString().split('_T')[0]);
                        });
                        
                        physicalVehicles.forEach(vId => {
                            const v = optimization.vehicles?.find(veh => veh._id === vId || veh._id.toString() === vId);
                            fixedCost += getFixedCost(v?.capacity || 0);
                        });
                        
                        // Note: If activeResult.totalCost is 0, we use distance-based fallback for variable
                        const distBasedVariable = variableCost || (activeResult.totalDistance * 18); // fallback ₹18/km
                        return `₹${Number(distBasedVariable + fixedCost).toFixed(2)}`;
                    })()}
                  </div>
                  <div className="text-xs text-slate-400">Fixed + Variable</div>
                </div>
              </>
            )
          })()}
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start mb-10">
          {/* Main Map (Left Column) */}
          <div className="w-full lg:w-3/5 xl:w-2/3 lg:sticky lg:top-8">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
              <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Route Visualization</h3>
                <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm text-sm hover:bg-slate-50 transition-colors">
                  <input type="checkbox" className="accent-blue-600" checked={useRoadNetwork} onChange={() => setUseRoadNetwork(v => !v)} />
                  <span className="text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap">Road Network (Beta)</span>
                </label>
              </div>
              <div className="h-[600px] w-full relative z-0">
                <MapComponent
                  locations={optimization.locations || []}
                  routes={activeResult.routes || []}
                  vehicles={optimization.vehicles || []}
                  useRoadNetwork={useRoadNetwork}
                  routedPolylines={routedPolylines}
                  selectedRouteIndex={selectedRouteIndex}
                  optimizationId={optimization._id}
                  onRoutedPolylinesUpdate={(routeIndex, coordinates) => {
                    setRoutedPolylines(prev => ({
                      ...prev,
                      [routeIndex]: coordinates
                    }));
                  }}
                  center={mapCenter}
                  zoom={13}
                />
              </div>
            </div>
          </div>

          {/* Logistics Manifest (Right Column) */}
          <div className="w-full lg:w-2/5 xl:w-1/3 lg:max-h-[85vh] lg:overflow-y-auto pr-2 custom-scrollbar">
            {/* Strategy Switcher (Moved here for better UX) */}
            {optimization.algorithmResults?.length > 1 && (
              <div className="bg-indigo-600 dark:bg-indigo-500 rounded-2xl p-4 mb-4 shadow-md shadow-indigo-200 dark:shadow-none anim-fade-up">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white">
                      <FaCogs />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">Select Strategy</p>
                      <p className="text-white font-bold text-sm">Algorithm Results</p>
                    </div>
                  </div>
                </div>
                <select 
                  value={selectedResultIndex}
                  onChange={(e) => setSelectedResultIndex(parseInt(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 border-none rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-white/50 cursor-pointer py-2.5 px-4 shadow-sm"
                >
                  <option value={-1}>Initial Solution ({optimization.selectedAlgorithm || 'Default'})</option>
                  {uniqueResults.map((res, idx) => {
                    const realIdx = optimization.algorithmResults.findIndex(r => r === res);
                    return (
                      <option key={idx} value={realIdx}>{res.algorithm.toUpperCase()} Solution</option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/10">
                <div className="flex flex-col">
                  <h3 className="font-bold text-xs uppercase tracking-widest text-slate-500">Logistics Manifest</h3>
                </div>
                <span className="text-[10px] font-black text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase">
                  {activeResult.routes?.length || 0} Routes
                </span>
              </div>

              <div className="p-4">
                <div className="space-y-4">
                  {(activeResult.routes || []).map((route, i) => (
                    <div key={i} className="anim-fade-up" style={{ animationDelay: `${i * 100}ms` }}>
                      <RouteCard
                        route={route}
                        index={i}
                        vehicles={optimization.vehicles}
                        drivers={drivers}
                        isSelected={selectedRouteIndex === i}
                        onSelect={() => setSelectedRouteIndex(selectedRouteIndex === i ? -1 : i)}
                        onAssignDriver={handleDriverAssign}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ================== SUB-COMPONENTS ==================
const RouteCard = ({ route, index, vehicles = [], drivers = [], isSelected, onSelect, onAssignDriver }) => {
  const vehicle = vehicles?.find(v => v._id === route.vehicle || v._id.toString() === route.vehicle) || vehicles?.[index % (vehicles?.length || 1)] || { name: `Vehicle ${index + 1}`, capacity: 100 };
  const [isExpanded, setIsExpanded] = useState(false);
  const vType = (vehicle?.vehicle_type || 'LARGE').toUpperCase();
  const isOverloaded = (route?.totalCapacity || 0) > (vehicle?.capacity || 0);

  // 🚩 Calculate Route Violations for this specific vehicle
    const geoViolations = useMemo(() => {
        return (route.stops || []).filter(stop => {
            const rType = (stop.road_type || 'STANDARD').toUpperCase();
            if (rType === 'NARROW' && vType !== 'SMALL') return true;
            if (rType === 'STANDARD' && vType === 'LARGE') return true;
            return false;
        }).length;
    }, [route.stops, vType]);

    const timeViolations = route.timeViolationCount || 0;

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all overflow-hidden mb-4 ${isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-200 dark:border-slate-700 shadow-sm'}`}>
      <div className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer" onClick={onSelect}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
            {index + 1}
          </div>
          <div>
            <div className="flex items-center gap-2">
               <h4 className="font-bold text-slate-800 dark:text-white">{vehicle.name}</h4>
               <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                   vType === 'SMALL' ? 'bg-blue-100 text-blue-600' : 
                   vType === 'MEDIUM' ? 'bg-amber-100 text-amber-600' : 
                   'bg-slate-100 text-slate-600'
               }`}>
                 {vType}
               </span>
               {geoViolations > 0 && (
                 <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 flex items-center gap-1">
                   <FaExclamationTriangle className="text-[8px]" /> {geoViolations} Geo
                 </span>
               )}
               {timeViolations > 0 && (
                 <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 flex items-center gap-1">
                   <FaClock className="text-[8px]" /> {timeViolations} Late
                 </span>
               )}
               {isOverloaded && (
                 <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-600 text-white animate-pulse">
                   Overload
                 </span>
               )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold mt-0.5">
              <span className="flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                <FaRoute className="text-blue-500 opacity-70" /> {route.stops?.length || 0} stops
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="flex items-center gap-1">
                <FaRoad className="text-slate-400 opacity-70" /> {formatDistance(route.distance)}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="flex items-center gap-1">
                <FaClock className="text-amber-500 opacity-70" /> {formatDuration(route.duration)}
              </span>
            </div>
            <div className={`mt-2 flex items-center gap-2 text-xs font-bold ${isOverloaded ? 'text-red-500' : 'text-emerald-600'}`}>
               <FaBox className="text-[10px]" /> 
               {route.totalCapacity || 0} / {vehicle.capacity || 100} units 
               <span className="text-[10px] opacity-60">({((route.totalCapacity / (vehicle.capacity || 1)) * 100).toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4" onClick={e => e.stopPropagation()}>
          <div className="bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                    <FaUserTie className="text-slate-400" />
                    <select 
                        value={route.driverId || ''} 
                        onChange={(e) => onAssignDriver(index, e.target.value)}
                        className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-0 py-0 pr-8"
                    >
                        <option value="">Unassigned</option>
                        {drivers.map(d => (
                            <option key={d._id} value={d._id}>{d.name} ({d.driverId})</option>
                        ))}
                    </select>
                </div>
          </div>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 font-bold text-xs hover:underline flex items-center gap-1"
          >
            {isExpanded ? 'Hide Timeline' : 'View Timeline'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-5 pb-5 border-t border-slate-50 dark:border-slate-700 pt-2">
            <RouteTimeline route={route} />
        </div>
      )}
    </div>
  );
};

export default OptimizationDetail;