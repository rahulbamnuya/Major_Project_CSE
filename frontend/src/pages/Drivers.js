import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { FaPlus, FaIdCard, FaPhone, FaMapMarkerAlt, FaAddressCard, FaEdit, FaTrash, FaSearch } from 'react-icons/fa';
import { useToast } from '../components/ToastProvider';
import TableSkeleton from '../components/LoadingSkeleton';

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { notify } = useToast();

  useEffect(() => {
    fetchDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchDrivers() {
    try {
      setLoading(true);
      // Ensure your backend actually has this route! 
      // If not, you'll need to create it. Assuming it exists based on previous file content.
      const res = await axios.get('/api/drivers');
      setDrivers(res.data);
    } catch (err) {
      console.error('Fetch drivers error', err);
      notify('Failed to load drivers list', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this driver profile?')) return;
    try {
      await axios.delete(`/api/drivers/${id}`);
      setDrivers(prev => prev.filter(d => d._id !== id));
      notify('Driver profile deleted', 'success');
    } catch (err) {
      console.error('Delete error', err);
      notify('Could not delete driver', 'error');
    }
  }

  const filteredDrivers = drivers.filter(d =>
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.driverId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 font-sans text-slate-800 dark:text-slate-100">
      <div className="container mx-auto px-4 md:px-8 py-8 md:py-12 max-w-7xl">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 anim-fade-up">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-2">
              Driver Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
              Manage your fleet personnel and assignments.
            </p>
          </div>
          <Link
            to="/drivers/add"
            className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <FaPlus className="text-sm group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-bold tracking-wide">Add New Driver</span>
          </Link>
        </div>

        {/* Search & Toolbar */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 mb-8 flex flex-col md:flex-row gap-4 justify-between items-center anim-fade-up">
          <div className="relative w-full md:w-96">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          <div className="text-sm text-slate-500 font-medium">
            Total Drivers: <span className="text-slate-900 dark:text-white font-bold">{drivers.length}</span>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-lg border border-slate-100 dark:border-slate-700">
            <TableSkeleton lines={5} />
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-700 anim-fade-up">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <FaIdCard className="text-3xl text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No Drivers Found</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
              {drivers.length === 0 ? "Get started by adding your first driver to the system." : "No drivers match your search criteria."}
            </p>
            {drivers.length === 0 && (
              <Link to="/drivers/add" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
                Add Driver
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 anim-fade-up">
            {filteredDrivers.map(driver => (
              <div key={driver._id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-md border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-all duration-300 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                      {driver.name ? driver.name.charAt(0).toUpperCase() : 'D'}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{driver.name}</h3>
                      <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded uppercase tracking-wider">
                        {driver.driverId || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => navigate(`/drivers/edit/${driver._id}`)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDelete(driver._id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <FaPhone className="text-slate-400" />
                    {driver.phone || <span className="text-slate-400 italic">No phone</span>}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <FaAddressCard className="text-slate-400" />
                    <span className="truncate">{driver.licenseNumber || <span className="text-slate-400 italic">No license info</span>}</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <FaMapMarkerAlt className="text-slate-400 mt-1" />
                    <span className="line-clamp-2">{driver.address || <span className="text-slate-400 italic">No address</span>}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
