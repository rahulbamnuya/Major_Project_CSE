import React, { useState } from 'react';
import api from '../services/api'; // Use configured API service
import { FaTruck, FaMapMarkerAlt, FaClock, FaClipboardList, FaSearch, FaDirections, FaBoxOpen } from 'react-icons/fa';
import { useToast } from '../components/ToastProvider';
import Map from '../components/Map';

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

const DriverPortal = () => {
    const [licenseNumber, setLicenseNumber] = useState('123123123');
    const [driverData, setDriverData] = useState(null);
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeRouteIndex, setActiveRouteIndex] = useState(null);
    const { notify } = useToast();

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!licenseNumber.trim()) return;

        setLoading(true);
        try {
            const res = await api.post('/drivers/portal', { licenseNumber });
            setDriverData(res.data.driver);
            setRoutes(res.data.routes);
            if (res.data.routes.length === 0) {
                notify('No active routes found for your profile.', 'info');
            } else {
                notify(`Welcome Back, ${res.data.driver.name}!`, 'success');
                // Auto-select first route if available
                if (res.data.routes.length > 0) setActiveRouteIndex(0);
            }
        } catch (err) {
            console.error(err);
            notify('Driver not found or error accessing portal.', 'error');
            setDriverData(null);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        setDriverData(null);
        setRoutes([]);
        setLicenseNumber('');
        setActiveRouteIndex(null);
    };

    if (!driverData) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full space-y-6 animate-fade-in-up">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
                            <FaTruck className="text-3xl text-white" />
                        </div>
                        <h1 className="text-2xl font-extrabold text-slate-900">Driver Portal</h1>
                        <p className="text-slate-500">Access your assigned routes and manifests.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">License Number</label>
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none uppercase font-mono tracking-wide"
                                    placeholder="Enter License No."
                                    value={licenseNumber}
                                    onChange={(e) => setLicenseNumber(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            {loading ? <span className="animate-spin">⌛</span> : 'Access Portal'}
                        </button>
                    </form>

                    <div className="text-center text-xs text-slate-400">
                        RouteOptimizer Logistics Platform &copy; 2024
                    </div>
                </div>
            </div>
        );
    }

    const activeRoute = activeRouteIndex !== null ? routes[activeRouteIndex].route : null;
    const activeOptimizationId = activeRouteIndex !== null ? routes[activeRouteIndex].optimizationId : null;

    const handleUpdateStatus = async (stopIndex, newStatus) => {
        if (!activeOptimizationId) {
            notify("Error: Missing optimization ID. Cannot update.", "error");
            return;
        }

        try {
            await api.put(`/optimization/${activeOptimizationId}/route/${routes[activeRouteIndex].routeIndex}/stop/${stopIndex}/status`, {
                status: newStatus
            });

            // Optimistic update
            const newRoutes = [...routes];
            if (newRoutes[activeRouteIndex].route.stops[stopIndex]) {
                newRoutes[activeRouteIndex].route.stops[stopIndex].status = newStatus;
                setRoutes(newRoutes);
                notify(`Status updated to ${newStatus}`, 'success');
            }
        } catch (err) {
            console.error(err);
            notify("Failed to update status", "error");
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 pb-20 text-slate-100 font-sans">

            {/* Navbar */}
            <div className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-50 shadow-md">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-white text-lg">
                            {driverData.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="font-bold text-white leading-tight">{driverData.name}</h2>
                            <p className="text-xs text-slate-400 font-mono tracking-wider">{driverData.driverId}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="text-xs sm:text-sm font-semibold text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors border border-slate-600">
                        Sign Out
                    </button>
                </div>
            </div>

            <div className="container mx-auto p-4 md:p-6 max-w-6xl">

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Left: Route List (Takes less space on large screens) */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-300 flex items-center gap-2">
                                <FaClipboardList /> Assignments
                            </h3>
                            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{routes.length}</span>
                        </div>

                        {routes.length === 0 ? (
                            <div className="bg-slate-800 rounded-xl p-8 text-center border border-slate-700 border-dashed">
                                <FaBoxOpen className="mx-auto text-4xl text-slate-600 mb-2" />
                                <p className="text-slate-400">No pending routes found.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {routes.map((item, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setActiveRouteIndex(idx)}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden ${activeRouteIndex === idx
                                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 border-transparent shadow-lg shadow-indigo-500/20'
                                            : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-750'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1 relative z-10">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${activeRouteIndex === idx ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                                {new Date(item.date).toLocaleDateString()}
                                            </span>
                                            <span className={`text-[10px] font-mono ${activeRouteIndex === idx ? 'text-blue-100' : 'text-slate-500'}`}>{item.optimizationName}</span>
                                        </div>
                                        <h4 className={`font-bold text-lg mb-2 relative z-10 ${activeRouteIndex === idx ? 'text-white' : 'text-slate-200'}`}>{item.route.stops.length} Stops</h4>
                                        <div className={`flex items-center gap-4 text-xs font-medium relative z-10 ${activeRouteIndex === idx ? 'text-blue-100' : 'text-slate-400'}`}>
                                            <span className="flex items-center gap-1.5"><FaMapMarkerAlt /> {Number(item.route.distance).toFixed(1)} km</span>
                                            <span className="flex items-center gap-1.5"><FaClock /> {Math.round(item.route.duration)} min</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Map & Details logic */}
                    <div className="lg:col-span-8 space-y-6">
                        {activeRoute ? (
                            <>
                                {/* Map Card */}
                                <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl h-[300px] lg:h-[400px]">
                                    <Map
                                        locations={activeRoute.stops.map(s => ({
                                            _id: s.locationId || Math.random(),
                                            latitude: s.latitude || s.lat,
                                            longitude: s.longitude || s.lng,
                                            name: s.locationName
                                        }))}
                                        routes={[activeRoute]}
                                        vehicles={[]}
                                        center={activeRoute.stops.length > 0 ? [activeRoute.stops[0].latitude, activeRoute.stops[0].longitude] : null}
                                    />
                                </div>

                                {/* Itinerary Card */}
                                <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
                                    <h3 className="font-bold text-white mb-6 text-lg flex items-center gap-2">
                                        <FaDirections className="text-indigo-400" /> Itinerary
                                    </h3>

                                    <div className="space-y-0 relative border-l-2 border-slate-600 ml-3.5 pb-2">
                                        {activeRoute.stops.map((stop, i) => {
                                            const isStart = i === 0;
                                            const status = stop.status || 'Pending'; // Default
                                            const isEnd = i === activeRoute.stops.length - 1;
                                            // Navigation URL
                                            const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude || stop.lat},${stop.longitude || stop.lng}`;

                                            return (
                                                <div key={i} className="relative pl-8 pb-8 last:pb-0 group">
                                                    {/* Timeline Dot */}
                                                    <div className={`absolute -left-[9px] top-0 w-5 h-5 rounded-full border-4 border-slate-800 ${status === 'Delivered' ? 'bg-green-500' :
                                                        status === 'En Route' ? 'bg-yellow-400 animate-pulse' :
                                                            isStart ? 'bg-blue-500' : 'bg-slate-500'
                                                        } shadow-sm z-10`}></div>

                                                    <div className="bg-slate-700/30 hover:bg-slate-700/50 p-4 rounded-xl border border-slate-600/50 transition-colors">
                                                        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2 mb-2">
                                                            <div>
                                                                <h4 className="font-bold text-slate-100 text-sm sm:text-base leading-snug">{stop.locationName}</h4>
                                                                <div className="flex flex-wrap gap-2 mt-1">
                                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isStart || isEnd ? 'bg-slate-600 text-slate-300' : 'bg-indigo-900/50 text-indigo-300'}`}>
                                                                        {isStart ? 'Start Point' : isEnd ? 'End Point' : `Stop #${i}`}
                                                                    </span>
                                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${status === 'Delivered' ? 'bg-green-900/50 text-green-300' :
                                                                            status === 'En Route' ? 'bg-yellow-900/50 text-yellow-300' :
                                                                                'bg-slate-700 text-slate-400'
                                                                        }`}>
                                                                        {status}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <a
                                                                    href={navUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-lg"
                                                                >
                                                                    <FaDirections /> Nav
                                                                </a>

                                                                {/* Action Buttons */}
                                                                {status === 'Pending' && !isStart && (
                                                                    <button
                                                                        onClick={() => handleUpdateStatus(i, 'En Route')}
                                                                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg"
                                                                    >
                                                                        Start
                                                                    </button>
                                                                )}
                                                                {status === 'En Route' && (
                                                                    <button
                                                                        onClick={() => handleUpdateStatus(i, 'Delivered')}
                                                                        className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-2 rounded-lg"
                                                                    >
                                                                        Complete
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-600/50">
                                                            <div>
                                                                <span className="block text-[10px] uppercase text-slate-500 font-bold mb-0.5">Estimated Arrival</span>
                                                                <span className="text-xl font-mono text-white tracking-tight">{formatTime(stop.arrivalTime)}</span>
                                                            </div>
                                                            {stop.demand > 0 && (
                                                                <div>
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
                            </>
                        ) : (
                            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-500 p-10 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/30">
                                <FaMapMarkerAlt className="text-6xl mb-6 opacity-20 text-indigo-500" />
                                <h3 className="text-xl font-bold text-slate-400 mb-2">No Route Selected</h3>
                                <p className="text-sm">Select a route from the sidebar to view the full manifest and map.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DriverPortal;
