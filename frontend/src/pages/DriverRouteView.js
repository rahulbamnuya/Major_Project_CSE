import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import OptimizationService from '../services/optimization.service';
import api from '../services/api';
import Map from '../components/Map';
import { FaTruck, FaMapMarkerAlt, FaClock, FaDirections, FaBoxOpen, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { useToast } from '../components/ToastProvider';

// Helper to format seconds into HH:MM AM/PM
const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const totalMinutes = Math.floor(seconds / 60);
    const h24 = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const DriverRouteView = () => {
    const { id, routeIndex } = useParams();
    const [optimization, setOptimization] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { notify } = useToast();

    // Fetch data on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Use Public API endpoint (no auth required)
                const data = await OptimizationService.getPublic(id);
                setOptimization(data);
                setLoading(false);
            } catch (err) {
                console.error(err);
                setError("Failed to load route data. Please verify the link.");
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleUpdateStatus = async (stopIndex, newStatus) => {
        try {
            // Call public status update endpoint
            await api.put(`/optimization/${id}/route/${routeIndex}/stop/${stopIndex}/status`, {
                status: newStatus
            });

            // Optimistic Update
            setOptimization(prev => {
                const updated = { ...prev };
                const route = updated.routes[routeIndex];
                if (route && route.stops[stopIndex]) {
                    route.stops[stopIndex].status = newStatus;
                }
                return updated;
            });

            notify(`Status updated to ${newStatus}`, 'success');
        } catch (err) {
            console.error(err);
            notify("Failed to update status. Please try again.", "error");
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900 text-white"><span className="animate-spin text-4xl">⌛</span></div>;
    if (error) return <div className="flex h-screen items-center justify-center bg-slate-900 text-red-400 p-4 text-center">{error}</div>;
    if (!optimization || !optimization.routes[routeIndex]) return <div className="flex h-screen items-center justify-center bg-slate-900 text-white">Route not found.</div>;

    const route = optimization.routes[routeIndex];
    const assignedVehicle = optimization.vehicles.find(v => v._id === route.vehicle);

    return (
        <div className="min-h-screen bg-slate-900 pb-20 text-slate-100 font-sans">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-50 shadow-md">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-white text-lg">
                            <FaTruck />
                        </div>
                        <div>
                            <h2 className="font-bold text-white leading-tight">Driver View</h2>
                            <p className="text-xs text-slate-400 font-mono tracking-wider">{assignedVehicle?.name || 'Unassigned Vehicle'}</p>
                        </div>
                    </div>
                    <div className="text-xs bg-slate-700 px-3 py-1 rounded-full text-slate-300">
                        {new Date(optimization.date || optimization.createdAt).toLocaleDateString()}
                    </div>
                </div>
            </div>

            <div className="container mx-auto p-4 md:p-6 max-w-3xl">
                {/* Route Summary */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="text-xs text-slate-400 uppercase font-bold mb-1">Total Stops</div>
                        <div className="text-2xl font-bold text-white flex items-center gap-2">
                            {route.stops.length} <span className="text-sm font-normal text-slate-500">stops</span>
                        </div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="text-xs text-slate-400 uppercase font-bold mb-1">Distance</div>
                        <div className="text-2xl font-bold text-white flex items-center gap-2">
                            {route.distance.toFixed(1)} <span className="text-sm font-normal text-slate-500">km</span>
                        </div>
                    </div>
                </div>

                {/* Map Card */}
                <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl h-[300px] mb-6 relative z-0">
                    <Map
                        locations={route.stops.map(s => ({
                            _id: s.locationId || Math.random(),
                            latitude: s.latitude,
                            longitude: s.longitude,
                            name: s.locationName
                        }))}
                        routes={[route]}
                        vehicles={[]}
                        center={route.stops.length > 0 ? [route.stops[0].latitude, route.stops[0].longitude] : null}
                    />
                </div>

                {/* Itinerary */}
                <div className="space-y-4">
                    <h3 className="font-bold text-white text-lg flex items-center gap-2 border-b border-slate-700 pb-2">
                        <FaDirections className="text-indigo-400" /> Route Itinerary
                    </h3>

                    <div className="space-y-0 relative border-l-2 border-slate-700 ml-3.5 pb-2">
                        {route.stops.map((stop, i) => {
                            const isStart = i === 0;
                            const isEnd = i === route.stops.length - 1;
                            const status = stop.status || 'Pending';
                            const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}`;
                            const isLate = stop.timeWindowEnd && stop.arrivalTime > stop.timeWindowEnd * 60;

                            return (
                                <div key={i} className="relative pl-8 pb-8 last:pb-0 group">
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[9px] top-0 w-5 h-5 rounded-full border-4 border-slate-900 ${status === 'Delivered' ? 'bg-green-500' :
                                            status === 'En Route' ? 'bg-yellow-400 animate-pulse' :
                                                isStart ? 'bg-blue-500' : 'bg-slate-500'
                                        } shadow-sm z-10`}></div>

                                    <div className={`p-4 rounded-xl border transition-colors ${status === 'Delivered' ? 'bg-slate-800/50 border-green-900/30' :
                                            'bg-slate-800 border-slate-700'
                                        }`}>
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2 mb-3">
                                            <div>
                                                <h4 className="font-bold text-slate-100 text-base leading-snug">{stop.locationName}</h4>
                                                {stop.address && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{stop.address}</p>}

                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isStart || isEnd ? 'bg-slate-600 text-slate-300' : 'bg-indigo-900/50 text-indigo-300'}`}>
                                                        {isStart ? 'Start' : isEnd ? 'End' : `Stop #${i}`}
                                                    </span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${status === 'Delivered' ? 'bg-green-900/50 text-green-300' :
                                                            status === 'En Route' ? 'bg-yellow-900/50 text-yellow-300' :
                                                                'bg-slate-700 text-slate-400'
                                                        }`}>
                                                        {status}
                                                    </span>
                                                    {isLate && <span className="bg-red-900/50 text-red-300 text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1"><FaExclamationTriangle /> Late</span>}
                                                </div>
                                            </div>

                                            <div className="flex gap-2 mt-2 sm:mt-0">
                                                <a href={navUrl} target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors border border-slate-600">
                                                    <FaDirections /> Nav
                                                </a>

                                                {/* Action Buttons */}
                                                {(status === 'Pending' || !status) && !isStart && (
                                                    <button onClick={() => handleUpdateStatus(i, 'En Route')} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg shadow-blue-900/20">
                                                        Start
                                                    </button>
                                                )}
                                                {status === 'En Route' && (
                                                    <button onClick={() => handleUpdateStatus(i, 'Delivered')} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg shadow-green-900/20">
                                                        Complete
                                                    </button>
                                                )}
                                                {status === 'Delivered' && (
                                                    <div className="flex-1 sm:flex-none flex items-center justify-center gap-1 text-green-500 text-xs font-bold px-3 py-2">
                                                        <FaCheckCircle /> Done
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Time & Demand Details */}
                                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-700/50">
                                            <div>
                                                <span className="block text-[10px] uppercase text-slate-500 font-bold mb-0.5">ETA</span>
                                                <span className={`text-sm font-mono tracking-tight font-bold ${isLate ? 'text-red-400' : 'text-white'}`}>
                                                    {formatTime(stop.arrivalTime)}
                                                </span>
                                            </div>
                                            {(stop.demand > 0) && (
                                                <div className="text-right">
                                                    <span className="block text-[10px] uppercase text-slate-500 font-bold mb-0.5">Delivery</span>
                                                    <span className="text-sm font-bold text-indigo-300 bg-indigo-900/30 px-2 py-1 rounded inline-block">
                                                        {stop.demand} Units
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

                <div className="mt-8 text-center text-xs text-slate-500 pb-8">
                    Driver Companion App • RouteOptimizer
                </div>
            </div>
        </div>
    );
};

export default DriverRouteView;
