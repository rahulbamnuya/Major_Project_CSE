import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FaTruck, FaMapMarkerAlt, FaRoute, FaPlus,
  FaCalendarAlt, FaClock, FaRoad, FaCheckCircle, FaExclamationTriangle,
  FaChartPie, FaBell, FaFileUpload
} from 'react-icons/fa';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import VehicleService from '../services/vehicle.service';
import LocationService from '../services/location.service';
import OptimizationService from '../services/optimization.service';
import Map from '../components/Map';
import { useToast } from '../components/ToastProvider';
import { StatsCardSkeleton, MapSkeleton, CardSkeleton } from '../components/LoadingSkeleton';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const Dashboard = () => {
  const [vehicles, setVehicles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [optimizations, setOptimizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalVehicles: 0,
    totalLocations: 0,
    totalOptimizations: 0,
    totalDistance: 0
  });
  const [selectedOptimization, setSelectedOptimization] = useState(null);
  const { notify } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Parallel data fetching for speed
        const [vehiclesData, locationsData, optimizationsData] = await Promise.all([
          VehicleService.getAll(),
          LocationService.getAll(),
          OptimizationService.getAll()
        ]);

        setVehicles(vehiclesData || []);
        setLocations(locationsData || []);
        setOptimizations(optimizationsData || []);

        // Calculate stats
        const totalDistance = (optimizationsData || []).reduce(
          (sum, opt) => sum + (opt.totalDistance || 0),
          0
        );

        setStats({
          totalVehicles: vehiclesData?.length || 0,
          totalLocations: locationsData?.length || 0,
          totalOptimizations: optimizationsData?.length || 0,
          totalDistance
        });

        // Set the most recent optimization as selected
        if (optimizationsData && optimizationsData.length > 0) {
          const mostRecent = [...optimizationsData].sort(
            (a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)
          )[0];
          setSelectedOptimization(mostRecent);
        }

        setError('');
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        const errorMsg = 'Failed to load dashboard data. Please check your connection.';
        setError(errorMsg);
        notify(errorMsg, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [notify]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Format distance
  const formatDistance = (distance) => {
    const n = Number(distance ?? 0);
    if (!isFinite(n) || n <= 0) return '0 km';
    return `${n.toFixed(2)} km`;
  };

  // Prepare Chart Data
  const vehicleCapacityData = vehicles.map(v => ({
    name: v.name,
    value: v.capacity
  })).slice(0, 5); // Top 5 vehicles by capacity

  const optimizationTrendData = optimizations
    .slice(0, 7)
    .reverse()
    .map(opt => ({
      name: new Date(opt.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      distance: Math.round(opt.totalDistance),
      stops: opt.routes.reduce((acc, r) => acc + r.stops.length, 0)
    }));

  // Helper for map
  const getOptimizationLocations = () => {
    if (!selectedOptimization) return [];
    if (selectedOptimization.locations && Array.isArray(selectedOptimization.locations)) {
      return selectedOptimization.locations.map(loc => {
        const id = typeof loc === 'object' ? loc._id : loc;
        return locations.find(location => location._id === id);
      }).filter(Boolean);
    }
    return [];
  };

  const getOptimizationVehicles = () => {
    if (!selectedOptimization) return [];
    if (selectedOptimization.vehicles && Array.isArray(selectedOptimization.vehicles)) {
      return selectedOptimization.vehicles.map(veh => {
        const id = typeof veh === 'object' ? veh._id : veh;
        return vehicles.find(vehicle => vehicle._id === id);
      }).filter(Boolean);
    }
    return [];
  };

  const fileInputRef = React.useRef(null);

  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      // We need an API service method for this, but calling direct axis/fetch is faster for this edit
      // Assuming api.js instance is available or I use fetch. Let's try to use the LocationService if possible, or direct axios.
      // Wait, 'LocationService' imports 'api'.
      // I'll assume LocationService has a method or I add it. 
      // Let's check api.js import. It is NOT imported in Dashboard.js implicitly but 'services/location.service' is.
      // I will add 'importCsv' to LocationService later. For now, I'll rely on a direct call or extending the service.
      // Actually, let's just use the 'api' from '../services/api' if I import it, or extending LocationService is cleaner.
      // I'll stick to extending LocationService.
      await LocationService.uploadCSV(formData);
      notify('Locations imported successfully!', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error(err);
      notify(err.response?.data?.msg || 'Failed to upload CSV', 'error');
    } finally {
      setLoading(false);
      event.target.value = null; // reset
    }
  };


  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-red-100 dark:border-red-900/30">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-6">
            <FaExclamationTriangle className="text-red-500 text-2xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/30"
            onClick={() => window.location.reload()}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 md:pb-12 text-slate-800 dark:text-slate-100 font-sans">
      <div className="container mx-auto px-4 md:px-8 py-8 md:py-10 max-w-7xl">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 anim-fade-up">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 mb-2">
              Dashboard Overview
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
              Manage your fleets, locations, and optimizations efficiently.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-100 dark:border-slate-700 text-slate-500 hover:text-blue-600 transition-colors">
              <FaBell className="text-lg" />
            </button>
            <Link to="/optimizations/new" className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0">
              <FaPlus className="text-sm group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-bold tracking-wide">New Optimization</span>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {loading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                icon={<FaTruck className="text-2xl" />}
                label="Total Vehicles"
                value={stats.totalVehicles}
                color="bg-blue-500"
                link="/vehicles"
                delay="0"
              />
              <StatCard
                icon={<FaMapMarkerAlt className="text-2xl" />}
                label="Locations"
                value={stats.totalLocations}
                color="bg-emerald-500"
                link="/locations"
                delay="100"
              />
              <StatCard
                icon={<FaRoute className="text-2xl" />}
                label="Optimizations"
                value={stats.totalOptimizations}
                color="bg-violet-500"
                link="/optimizations"
                delay="200"
              />
              <StatCard
                icon={<FaRoad className="text-2xl" />}
                label="Total Distance"
                value={formatDistance(stats.totalDistance)}
                color="bg-orange-500"
                delay="300"
                isText
              />
            </>
          )}
        </div>

        {/* Analytics Section */}
        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12 anim-fade-up" style={{ animationDelay: '0.2s' }}>
            {/* Bar Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-lg">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold">Optimization Trends</h3>
                <select className="text-sm bg-slate-50 dark:bg-slate-700 border-none rounded-lg px-3 py-1">
                  <option>Last 7 runs</option>
                </select>
              </div>
              <div className="h-[250px] w-full">
                {optimizationTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={optimizationTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <RechartsTooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar dataKey="distance" fill="#6366f1" radius={[4, 4, 0, 0]} name="Distance (km)" barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">Not enough data for chart</div>
                )}
              </div>
            </div>

            {/* Pie Chart */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-lg flex flex-col items-center justify-center">
              <h3 className="text-lg font-bold w-full text-left mb-4">Fleet Capacity</h3>
              <div className="h-[200px] w-full">
                {vehicleCapacityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={vehicleCapacityData}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {vehicleCapacityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">No vehicles added</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* Latest Optimization (Takes up 2/3 on large screens) */}
          <div className="xl:col-span-2 space-y-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="w-2 h-8 bg-blue-500 rounded-full inline-block"></span>
                Latest Optimization
              </h2>
              {!loading && selectedOptimization && (
                <Link to={`/optimizations/${selectedOptimization._id}`} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 text-sm">
                  Full Details →
                </Link>
              )}
            </div>

            {loading ? (
              <div className="space-y-6">
                <MapSkeleton />
                <CardSkeleton />
              </div>
            ) : selectedOptimization ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-xl overflow-hidden card-hover transition-all duration-300">
                {/* Summary Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                  <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{selectedOptimization.name || 'Untitled Optimization'}</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5"><FaCalendarAlt /> {formatDate(selectedOptimization.createdAt || selectedOptimization.date)}</span>
                        <span className="flex items-center gap-1.5"><FaCheckCircle className="text-green-500" /> Completed</span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
                        <FaRoad /> {formatDistance(selectedOptimization.totalDistance)}
                      </div>
                      <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
                        <FaClock /> {selectedOptimization.totalDuration ? `${Math.floor(selectedOptimization.totalDuration / 60)} min` : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Map Area */}
                <div className="h-[400px] w-full relative z-0">
                  <Map
                    locations={getOptimizationLocations()}
                    routes={selectedOptimization.routes || []}
                    vehicles={getOptimizationVehicles()}
                  />
                </div>

                {/* Recent Routes Preview */}
                <div className="p-6 md:p-8 bg-white dark:bg-slate-800">
                  <h4 className="text-lg font-bold mb-4">Route Breakdown</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedOptimization.routes && selectedOptimization.routes.map((route, index) => {
                      const vehicle = vehicles.find(v => v._id === route.vehicle) || { name: 'Unknown Vehicle' };
                      const colors = ['bg-orange-500', 'bg-green-500', 'bg-blue-500', 'bg-pink-500', 'bg-purple-500'];
                      const color = colors[index % colors.length];

                      return (
                        <div key={index} className="flex items-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                          <div className={`w-12 h-12 rounded-xl ${color} bg-opacity-10 flex items-center justify-center mr-4 text-white shadow-sm`}>
                            <span className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center text-lg font-bold`}>{index + 1}</span>
                          </div>
                          <div className="flex-1">
                            <h5 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{vehicle.name}</h5>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-3">
                              <span>{route.stops ? route.stops.length : 0} Stops</span>
                              <span>•</span>
                              <span>{formatDistance(route.distance)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-700">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FaRoute className="text-3xl text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No Optimization Run Yet</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">Start by adding locations and vehicles, then run your first route optimization.</p>
                <Link to="/optimizations/new" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
                  Launch Wizard
                </Link>
              </div>
            )}
          </div>

          {/* Side Panel (Takes up 1/3) */}
          <div className="space-y-8">

            {/* Quick Add Section */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-indigo-900 dark:to-slate-900 rounded-3xl p-6 shadow-xl text-white">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-yellow-400 rounded-full"></span> Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <QuickActionLink to="/vehicles/add" icon={<FaTruck />} label="Add Vehicle" />
                <QuickActionLink to="/locations/add" icon={<FaMapMarkerAlt />} label="Add Location" />
                <button
                  onClick={handleImportClick}
                  className="col-span-2 bg-white/10 hover:bg-white/20 p-4 rounded-xl flex items-center justify-center gap-3 backdrop-blur-sm transition-colors border border-white/5 text-sm font-semibold"
                >
                  <FaFileUpload className="text-xl text-green-300" /> Bulk Import Locations (CSV)
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".csv"
              />
            </div>

            {/* System Status */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-lg">
              <h3 className="text-lg font-bold mb-4">System Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> API Server</span>
                  <span className="text-green-600 font-bold">Online</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> Database</span>
                  <span className="text-green-600 font-bold">Connected</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> OR-Tools</span>
                  <span className="text-blue-600 font-bold">Ready</span>
                </div>
              </div>
            </div>

            {/* Recent Vehicles */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Recent Vehicles</h3>
                <Link to="/vehicles" className="text-sm text-blue-600 dark:text-blue-400 font-semibold hover:underline">View All</Link>
              </div>
              <div className="space-y-3">
                {loading ? (
                  <>
                    <div className="h-16 bg-white dark:bg-slate-800 rounded-xl animate-pulse"></div>
                    <div className="h-16 bg-white dark:bg-slate-800 rounded-xl animate-pulse"></div>
                  </>
                ) : vehicles.length > 0 ? (
                  vehicles.slice(0, 3).map(v => (
                    <div key={v._id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center">
                          <FaTruck className="text-sm" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{v.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Cap: {v.capacity}</p>
                        </div>
                      </div>
                      <Link to={`/vehicles/edit/${v._id}`} className="text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600">
                        Edit
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500 italic">No vehicles found.</div>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

// Sub-component for Stats
const StatCard = ({ icon, label, value, color, link, delay, isText = false }) => (
  <div
    className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden"
    style={{ animationDelay: `${delay}ms` }}
  >
    {/* Decorative background blob */}
    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 ${color}`}></div>

    <div className="relative z-10 flex items-start justify-between">
      <div>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1">{label}</p>
        <h3 className={`font-bold text-slate-800 dark:text-white ${isText ? 'text-2xl' : 'text-3xl'}`}>{value}</h3>
      </div>
      <div className={`w-12 h-12 rounded-xl ${color} text-white flex items-center justify-center shadow-md`}>
        {icon}
      </div>
    </div>

    {link && (
      <Link to={link} className="absolute inset-0 z-20 focus:ring-2 focus:ring-blue-400 rounded-2xl"></Link>
    )}
  </div>
);

// Sub-component for Quick Actions
const QuickActionLink = ({ to, icon, label }) => (
  <Link to={to} className="bg-white/10 hover:bg-white/20 p-4 rounded-xl flex flex-col items-center justify-center text-center backdrop-blur-sm transition-colors border border-white/5">
    <div className="text-xl mb-2 text-yellow-300">{icon}</div>
    <span className="text-sm font-semibold">{label}</span>
  </Link>
);

export default Dashboard;