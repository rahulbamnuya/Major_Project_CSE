import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import VehicleService from '../services/vehicle.service';
import '../styles/Vehicles.css';
import { useToast } from '../components/ToastProvider';
import { StatsCardSkeleton, CardSkeleton } from '../components/LoadingSkeleton';
import {
  FaPlus,
  FaTruck,
  FaEdit,
  FaTrash,
  FaRoute,
  FaChartLine,
  FaCog,
  FaInfoCircle
} from 'react-icons/fa';


const Vehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { notify } = useToast();

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await VehicleService.getAll();
      setVehicles(response || []);
      setError('');
    } catch (err) {
      setError('Failed to load vehicles');
      notify('Failed to load vehicles', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      try {
        await VehicleService.remove(id);
        setVehicles(vehicles.filter(vehicle => vehicle._id !== id));
        notify('Vehicle deleted successfully', 'success');
      } catch (err) {
        const msg = err?.response?.data?.msg || ('Failed to delete vehicle: ' + err.message);
        notify(msg, 'error');
      }
    }
  };

  const getVehicleStats = () => {
    const total = vehicles.length;
    const totalCapacity = vehicles.reduce((sum, v) => sum + (v.capacity || 0), 0);
    const totalCount = vehicles.reduce((sum, v) => sum + (v.count || 0), 0);
    const avgCapacity = total > 0 ? Math.round(totalCapacity / total) : 0;

    return { total, totalCapacity, totalCount, avgCapacity };
  };

  const stats = getVehicleStats();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 md:pb-8 font-sans text-slate-800 dark:text-slate-100">
      <div className="container mx-auto px-4 md:px-8 py-8 md:py-10 max-w-7xl">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 anim-fade-up">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 mb-2">
              Fleet Management
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">
              Manage your vehicle fleet and specifications
            </p>
          </div>
          <Link
            to="/vehicles/add"
            className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <FaPlus className="text-sm group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-bold tracking-wide">Add Vehicle</span>
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
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Total Vehicles</p>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                    <FaTruck />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.total}</h3>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Total Units</p>
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
                    <FaRoute />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.totalCount}</h3>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Total Capacity</p>
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
                    <FaChartLine />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.totalCapacity}</h3>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Avg. Capacity</p>
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-lg">
                    <FaCog />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.avgCapacity}</h3>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-xl mb-8 flex items-center gap-3">
            <FaInfoCircle className="text-xl" />
            {error}
          </div>
        )}

        {/* Content Section */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-16 text-center shadow-lg max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <FaTruck className="text-4xl text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              No vehicles found
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8">
              Get started by adding your first vehicle to begin building your fleet and optimizing routes.
            </p>
            <Link
              to="/vehicles/add"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-colors"
            >
              <FaPlus /> Add Your First Vehicle
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white px-1">
              All Vehicles
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vehicles.map(vehicle => (
                <div
                  key={vehicle._id}
                  className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-900 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                      <FaTruck className="text-xl" />
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        to={`/vehicles/edit/${vehicle._id}`}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <FaEdit />
                      </Link>
                      <button
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        onClick={() => handleDelete(vehicle._id)}
                        title="Delete"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                    {vehicle.name}
                  </h3>

                  {vehicle.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 min-h-[2.5rem]">
                      {vehicle.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Capacity</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-1">
                        <FaChartLine className="text-blue-500 text-xs" /> {vehicle.capacity}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Count</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-1">
                        <FaRoute className="text-green-500 text-xs" /> {vehicle.count}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Vehicles;