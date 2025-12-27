import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import LocationService from '../services/location.service';
import Map from '../components/Map';
import '../styles/Locations.css';
import { StatsCardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/ToastProvider';
import { FaPlus, FaMapMarkedAlt, FaEdit, FaTrash, FaWarehouse, FaMapPin, FaBox, FaClock } from 'react-icons/fa';

// ================== HELPER FUNCTION ==================
const minutesToTime = (minutes) => {
  if (minutes === null || typeof minutes === 'undefined' || isNaN(minutes)) return 'Anytime';
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};
// =====================================================

const Locations = () => {
  const [locations, setLocations] = useState([]);
  const [previewLocations, setPreviewLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapCenter, setMapCenter] = useState([22.7196, 75.8577]);
  const [mapZoom, setMapZoom] = useState(10);
  const { notify } = useToast();

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await LocationService.getAll();
      const fetchedLocations = response || [];
      setLocations(fetchedLocations);

      if (fetchedLocations.length > 0) {
        const validLocations = fetchedLocations.filter(loc =>
          loc.latitude && loc.longitude && !isNaN(Number(loc.latitude)) && !isNaN(Number(loc.longitude))
        );

        if (validLocations.length > 0) {
          const avgLat = validLocations.reduce((sum, loc) => sum + Number(loc.latitude), 0) / validLocations.length;
          const avgLng = validLocations.reduce((sum, loc) => sum + Number(loc.longitude), 0) / validLocations.length;
          setMapCenter([avgLat, avgLng]);
          setMapZoom(validLocations.length > 1 ? 12 : 15);
        }
      }

      setError('');
    } catch (err) {
      setError('Failed to load locations');
      notify('Failed to load locations', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this location?')) {
      try {
        await LocationService.remove(id);
        setLocations(locations.filter(location => location._id !== id));
        notify('Location deleted successfully', 'success');
      } catch (err) {
        const msg = err?.response?.data?.msg || 'Failed to delete location';
        notify(msg, 'error');
      }
    }
  };

  const handleLocationSelect = ({ latitude, longitude, name }) => {
    setPreviewLocations([{
      _id: 'preview',
      name: name || 'Selected Location',
      latitude,
      longitude,
      demand: 0,
      isDepot: false
    }]);
  };

  const getLocationStats = () => {
    const total = locations.length;
    const depots = locations.filter(loc => loc.isDepot).length;
    const deliveryPoints = total - depots;
    const totalDemand = locations.reduce((sum, loc) => sum + (loc.demand || 0), 0);

    return { total, depots, deliveryPoints, totalDemand };
  };

  const stats = getLocationStats();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 md:pb-8 font-sans text-slate-800 dark:text-slate-100">
      <div className="container mx-auto px-4 md:px-8 py-8 md:py-10 max-w-7xl">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 anim-fade-up">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 mb-2">
              Locations & Depots
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">
              Manage delivery points, customers, and distribution centers
            </p>
          </div>
          <Link
            to="/locations/add"
            className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <FaPlus className="text-sm group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-bold tracking-wide">Add Location</span>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {loading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Total Locations</p>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                    <FaMapMarkedAlt />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.total}</h3>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Depots</p>
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-lg">
                    <FaWarehouse />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.depots}</h3>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Customer Stops</p>
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
                    <FaMapPin />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.deliveryPoints}</h3>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Total Demand</p>
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
                    <FaBox />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.totalDemand}</h3>
              </div>
            </>
          )}
        </div>

        {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6">{error}</div>}

        {/* Map Section */}
        {locations.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden mb-12">
            <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Geo-Spatial Overview</h2>
              <p className="text-slate-600 dark:text-slate-400">Interactive map of all your registered depots and customer locations.</p>
            </div>
            <div className="h-[500px] w-full relative z-0">
              <Map
                locations={[...locations, ...previewLocations]}
                onLocationSelect={handleLocationSelect}
                center={mapCenter}
                zoom={mapZoom}
              />
            </div>
          </div>
        )}

        {/* Locations List */}
        {loading ? (
          <TableSkeleton rows={6} />
        ) : locations.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-16 text-center shadow-lg max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <FaMapMarkedAlt className="text-4xl text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">No locations found</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Add your first location to get started with route planning.</p>
            <Link to="/locations/add" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-colors">
              <FaPlus /> Add Location
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Location Registry</h2>
                <p className="text-slate-600 dark:text-slate-400">Comprehensive list of all points.</p>
              </div>
              <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-lg text-sm font-semibold">
                {locations.length} Records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Coordinates</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Demand</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time Window</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {locations.map(location => (
                    <tr key={location._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100 mb-0.5">{location.name}</div>
                        {location.address && <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={location.address}>{location.address}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300 font-mono">
                          {Number(location.latitude ?? 0).toFixed(4)}, {Number(location.longitude ?? 0).toFixed(4)}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        {location.isDepot
                          ? <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs font-bold border border-orange-100 dark:border-orange-800"><FaWarehouse /> Depot</span>
                          : <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold border border-blue-100 dark:border-blue-800"><FaMapPin /> Customer</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{location.demand || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <FaClock className="text-slate-400" />
                          {typeof location.timeWindowStart === 'number' && typeof location.timeWindowEnd === 'number'
                            ? `${minutesToTime(location.timeWindowStart)} - ${minutesToTime(location.timeWindowEnd)}`
                            : 'Anytime'
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/locations/edit/${location._id}`} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                            <FaEdit />
                          </Link>
                          <button onClick={() => handleDelete(location._id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Locations;