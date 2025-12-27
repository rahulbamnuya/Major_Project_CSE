import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../services/api'; // Use configured API service
import { FaUser, FaIdCard, FaMobileAlt, FaMapMarkerAlt, FaSave, FaArrowLeft, FaEnvelope, FaAddressCard } from 'react-icons/fa';
import { useToast } from '../components/ToastProvider';

const DriverForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    name: '',
    driverId: '',
    phone: '',
    email: '',
    licenseNumber: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEditMode);

  useEffect(() => {
    if (isEditMode) {
      const fetchDriver = async () => {
        try {
          const res = await api.get(`/drivers/${id}`);
          setFormData({
            name: res.data.name,
            driverId: res.data.driverId,
            phone: res.data.phone,
            email: res.data.email || '',
            licenseNumber: res.data.licenseNumber,
            address: res.data.address || ''
          });
        } catch (err) {
          console.error(err);
          notify('Failed to load driver details', 'error');
          navigate('/drivers');
        } finally {
          setFetchLoading(false);
        }
      };
      fetchDriver();
    }
  }, [id, isEditMode, navigate, notify]);

  const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditMode) {
        await api.put(`/drivers/${id}`, formData);
        notify('Driver updated successfully', 'success');
      } else {
        await api.post('/drivers', formData);
        notify('Driver added successfully', 'success');
      }
      navigate('/drivers');
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.msg || 'Error saving driver';
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-12 font-sans text-slate-800 dark:text-slate-100">
      <div className="container mx-auto px-4 py-8 max-w-3xl">

        <Link to="/drivers" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 transition-colors">
          <FaArrowLeft /> Back to Drivers
        </Link>

        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden anim-fade-up">
          <div className="p-8 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                {isEditMode ? <FaUser /> : <FaUser />}
              </span>
              {isEditMode ? 'Edit Driver Profile' : 'Add New Driver'}
            </h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400 pl-14">
              {isEditMode ? 'Update driver information and details.' : 'Register a new driver to your fleet.'}
            </p>
          </div>

          <form onSubmit={onSubmit} className="p-8 space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Full Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <FaUser className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={onChange}
                    required
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Enter driver's name"
                  />
                </div>
              </div>

              {/* Driver ID */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Driver ID <span className="text-red-500">*</span></label>
                <div className="relative">
                  <FaIdCard className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    name="driverId"
                    value={formData.driverId}
                    onChange={onChange}
                    required
                    disabled={isEditMode} // Prevent changing ID if needed, or allow it
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60"
                    placeholder="e.g. DRV-001"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Phone Number <span className="text-red-500">*</span></label>
                <div className="relative">
                  <FaMobileAlt className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={onChange}
                    required
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Email Address (Optional)</label>
                <div className="relative">
                  <FaEnvelope className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={onChange}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="driver@company.com"
                  />
                </div>
              </div>

              {/* License */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">License Number <span className="text-red-500">*</span></label>
                <div className="relative">
                  <FaAddressCard className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    name="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={onChange}
                    required
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="License No."
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Address</label>
              <div className="relative">
                <FaMapMarkerAlt className="absolute left-4 top-3.5 text-slate-400" />
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={onChange}
                  rows="3"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Full residential address"
                ></textarea>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
              <Link to="/drivers" className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all transform active:scale-95"
              >
                {loading ? <span className="animate-spin">⌛</span> : <FaSave />}
                {isEditMode ? 'Update Driver' : 'Save Driver'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DriverForm;
