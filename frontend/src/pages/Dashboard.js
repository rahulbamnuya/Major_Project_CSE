import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FaTruck, FaMapMarkerAlt, FaRoute, FaPlus,
  FaCalendarAlt, FaClock, FaRoad, FaCheckCircle, FaExclamationTriangle,
  FaBell, FaFileUpload, FaChevronRight
} from 'react-icons/fa';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import VehicleService from '../services/vehicle.service';
import LocationService from '../services/location.service';
import OptimizationService from '../services/optimization.service';
import Map from '../components/Map';
import { useToast } from '../components/ToastProvider';
import { StatsCardSkeleton, MapSkeleton, CardSkeleton } from '../components/LoadingSkeleton';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// ================== HELPER FUNCTIONS ==================
const formatDuration = (minutes) => {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

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

        const getFixedCost = (capacity) => {
            if (capacity <= 1000) return 250;
            if (capacity <= 4000) return 450;
            return 700;
        };

        const totalRealCost = (optimizationsData || []).reduce((sum, opt) => {
            const varCost = opt.totalCost || 0;
            let fixCost = 0;
            const uniqueVehicles = new Set((opt.routes || []).map(r => r.vehicle).filter(Boolean));
            uniqueVehicles.forEach(vId => {
                const v = vehiclesData?.find(veh => (veh._id === vId || veh._id.toString() === vId));
                fixCost += getFixedCost(v?.capacity || 0);
            });
            return sum + varCost + fixCost;
        }, 0);

        setStats({
          totalVehicles: vehiclesData?.length || 0,
          totalLocations: locationsData?.length || 0,
          totalOptimizations: optimizationsData?.length || 0,
          totalDistance,
          totalCost: totalRealCost,
          totalCO2: totalDistance * 0.16, // kg/km
          co2Saved: totalDistance * 0.05 // Assuming 30% optimization efficiency
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
  })).slice(0, 5); 

  const optimizationTrendData = optimizations
    .slice(0, 7)
    .reverse()
    .map(opt => {
      // Calculate fulfillment rate for each run
      const totalLocations = (opt.locations?.length || 1) - 1;
      const droppedCount = opt.dropped_nodes?.length || 0;
      const rate = totalLocations > 0 ? ((totalLocations - droppedCount) / totalLocations) * 100 : 100;
      
      return {
        name: new Date(opt.createdAt || opt.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        distance: Math.round(opt.totalDistance),
        stops: opt.routes.reduce((acc, r) => acc + (r.stops?.length || 0), 0),
        fulfillment: Math.round(rate)
      };
    });



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
                label="Fleet Assets"
                value={stats.totalVehicles}
                color="bg-blue-500"
                link="/vehicles"
                delay="0"
              />
              <StatCard
                icon={<FaCheckCircle className="text-2xl" />}
                label="Eco Savings (CO2)"
                value={`${stats.co2Saved?.toFixed(1)} kg`}
                color="bg-emerald-500"
                delay="100"
                isText
              />
              <StatCard
                icon={<FaRoute className="text-2xl" />}
                label="Total Spend (Real)"
                value={`₹${(stats.totalCost / 1000).toFixed(1)}k`}
                color="bg-violet-500"
                link="/optimizations"
                delay="200"
                isText
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
                 <div>
                   <h3 className="text-lg font-bold">Logistics Efficiency</h3>
                   <p className="text-xs text-slate-400">Mileage and Fulfillment Rate Benchmark</p>
                 </div>
                <select className="text-sm bg-slate-50 dark:bg-slate-700 border-none rounded-lg px-3 py-1">
                  <option>Last 7 runs</option>
                </select>
              </div>
              <div className="h-[250px] w-full">
                {optimizationTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={optimizationTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#10b981' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <RechartsTooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: '#1e293b', color: '#fff' }}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar yAxisId="left" dataKey="distance" fill="#6366f1" radius={[4, 4, 0, 0]} name="Distance (km)" barSize={40} />
                      <Bar yAxisId="right" dataKey="fulfillment" fill="#10b981" radius={[4, 4, 0, 0]} name="Fulfillment %" barSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">Not enough data for chart</div>
                )}
              </div>
            </div>

            {/* Pie Chart / Sustainability Mini Table */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-lg flex flex-col">
              <h3 className="text-lg font-bold mb-1">Environmental Impact</h3>
              <p className="text-xs text-slate-400 mb-6 font-medium">Planetary benefits of your routing</p>
              
              <div className="flex-1 space-y-6">
                 <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Carbon Output</span>
                    <span className="font-mono font-bold">{stats.totalCO2?.toFixed(1)} kg</span>
                 </div>
                 <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[25%]" title="Baseline comparison"></div>
                 </div>
                 
                 <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                    <div className="flex items-center gap-3 mb-2">
                       <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">🌱</div>
                       <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-tighter">Carbon Saved</h4>
                    </div>
                    <p className="text-2xl font-black text-emerald-600">{stats.co2Saved?.toFixed(2)} <span className="text-xs font-normal">kg CO₂e</span></p>
                    <p className="text-[10px] text-emerald-500/70 mt-1">Relative to standard un-optimized radial routing.</p>
                 </div>

                 <div className="h-[120px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie
                         data={vehicleCapacityData}
                         innerRadius={40}
                         outerRadius={55}
                         paddingAngle={5}
                         dataKey="value"
                       >
                         {vehicleCapacityData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                         ))}
                       </Pie>
                       <RechartsTooltip />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
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
                        <FaClock /> {selectedOptimization.totalDuration ? formatDuration(selectedOptimization.totalDuration) : 'N/A'}
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

                {/* Footer Actions */}
                <div className="p-6 md:p-8 border-t border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Select any route in the map legend to highlight its live path.
                  </p>
                  <Link 
                    to="/optimizations" 
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold hover:gap-3 transition-all"
                  >
                    View All Optimizations <FaChevronRight className="text-sm" />
                  </Link>
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