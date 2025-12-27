import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FaArrowLeft, FaTruck, FaSave, FaGasPump, FaUserTie,
  FaTachometerAlt, FaClock, FaInfoCircle
} from 'react-icons/fa';
import VehicleService from '../services/vehicle.service';
import { useToast } from '../components/ToastProvider';

const VehicleForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  const { notify } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    capacity: '',
    count: '1',
    fuel_cost_per_km: '10',
    driver_cost_per_km: '8',
    average_speed: '40',
    start_time: '08:00',
    end_time: '20:00',
    maxDistance: '1000'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchVehicle = useCallback(async () => {
    try {
      setLoading(true);
      const response = await VehicleService.get(id);
      // Ensure we handle missing fields gracefully with defaults
      setFormData({
        name: response.name || '',
        capacity: (response.capacity || '').toString(),
        count: (response.count || '1').toString(),
        fuel_cost_per_km: (response.fuel_cost_per_km || '10').toString(),
        driver_cost_per_km: (response.driver_cost_per_km || '8').toString(),
        average_speed: (response.average_speed || '40').toString(),
        start_time: response.start_time || '08:00',
        end_time: response.end_time || '20:00',
        maxDistance: (response.maxDistance || '1000').toString()
      });
      notify('Vehicle data loaded', 'success');
    } catch (err) {
      setError('Failed to load vehicle data');
      notify('Failed to load vehicle data', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, notify]);

  useEffect(() => {
    if (isEditMode) {
      fetchVehicle();
    }
  }, [isEditMode, fetchVehicle]);

  const onChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Convert numbers
      const vehicleData = {
        name: formData.name,
        capacity: parseInt(formData.capacity) || 0,
        count: parseInt(formData.count) || 1,
        fuel_cost_per_km: parseFloat(formData.fuel_cost_per_km) || 0,
        driver_cost_per_km: parseFloat(formData.driver_cost_per_km) || 0,
        average_speed: parseFloat(formData.average_speed) || 0,
        start_time: formData.start_time,
        end_time: formData.end_time,
        maxDistance: parseFloat(formData.maxDistance) || 0
      };

      if (isEditMode) {
        await VehicleService.update(id, vehicleData);
        notify('Vehicle updated successfully', 'success');
      } else {
        await VehicleService.create(vehicleData);
        notify('Vehicle created successfully', 'success');
      }

      navigate('/vehicles');
    } catch (err) {
      setError('Failed to save vehicle');
      notify('Failed to save vehicle', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 font-sans text-slate-900 dark:text-slate-100">
      <div className="container mx-auto px-6 py-8 max-w-4xl">

        {/* Header */}
        <div className="mb-8 anim-fade-up">
          <Link to="/vehicles" className="text-slate-500 hover:text-blue-600 flex items-center gap-2 mb-2 transition-colors">
            <FaArrowLeft className="text-sm" /> Back to Fleet
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {isEditMode ? 'Edit Vehicle Profile' : 'Add New Vehicle'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Configure specifications, costs, and availability for your fleet.</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800 mb-6 flex items-center gap-3">
            <FaInfoCircle /> {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Basic Info Card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6 pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                <FaTruck />
              </div>
              <h2 className="text-lg font-bold">Basic Specifications</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Vehicle Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={onChange}
                  required
                  placeholder="e.g. Heavy Duty Truck A"
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Capacity</label>
                  <input
                    type="number"
                    name="capacity"
                    value={formData.capacity}
                    onChange={onChange}
                    required
                    min="1"
                    placeholder="Units"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Quantity</label>
                  <input
                    type="number"
                    name="count"
                    value={formData.count}
                    onChange={onChange}
                    required
                    min="1"
                    disabled={isEditMode}
                    className={`w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 ${isEditMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Max Range (km)</label>
                <input
                  type="number"
                  name="maxDistance"
                  value={formData.maxDistance}
                  onChange={onChange}
                  min="1"
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Operations & Costs Card */}
          <div className="space-y-8">
            {/* Cost Panel */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6 pb-2 border-b border-slate-100 dark:border-slate-700">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
                  <FaGasPump />
                </div>
                <h2 className="text-lg font-bold">Operational Costs</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Fuel Cost (₹/km)</label>
                  <input
                    type="number"
                    name="fuel_cost_per_km"
                    value={formData.fuel_cost_per_km}
                    onChange={onChange}
                    min="0"
                    step="0.1"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Driver Rate (₹/km)</label>
                  <input
                    type="number"
                    name="driver_cost_per_km"
                    value={formData.driver_cost_per_km}
                    onChange={onChange}
                    min="0"
                    step="0.1"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Scheduling Panel */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6 pb-2 border-b border-slate-100 dark:border-slate-700">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                  <FaClock />
                </div>
                <h2 className="text-lg font-bold">Schedule & Performance</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Avg Speed (km/h)</label>
                  <div className="relative">
                    <FaTachometerAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      name="average_speed"
                      value={formData.average_speed}
                      onChange={onChange}
                      min="1"
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Shift Start</label>
                    <input
                      type="time"
                      name="start_time"
                      value={formData.start_time}
                      onChange={onChange}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Shift End</label>
                    <input
                      type="time"
                      name="end_time"
                      value={formData.end_time}
                      onChange={onChange}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="lg:col-span-2 flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => navigate('/vehicles')} className="px-8 py-4 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2">
              {loading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div> : <><FaSave /> Save Configuration</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default VehicleForm;