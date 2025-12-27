import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import OptimizationService from '../services/optimization.service';
import '../styles/Optimizations.css';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/ToastProvider';
import {
  FaPlus,
  FaCalendarAlt,
  FaRoute,
  FaRoad,
  FaClock,
  FaTrash,
  FaEye
} from 'react-icons/fa';

const Optimizations = () => {
  const [optimizations, setOptimizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { notify } = useToast();

  useEffect(() => {
    fetchOptimizations();
  }, []);

  const fetchOptimizations = async () => {
    try {
      setLoading(true);
      const response = await OptimizationService.getAll();
      setOptimizations(response);
      setError('');
    } catch (err) {
      setError('Failed to load optimizations');
      notify('Failed to load optimizations', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this optimization?')) {
      try {
        await OptimizationService.remove(id);
        const updated = optimizations.filter(opt => opt._id !== id);
        setOptimizations(updated);
        notify('Optimization deleted', 'success');
      } catch (err) {
        const msg = err?.response?.data?.msg || 'Failed to delete optimization';
        notify(msg, 'error');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 md:pb-8 font-sans text-slate-800 dark:text-slate-100">
      <div className="container mx-auto px-4 md:px-8 py-8 md:py-10 max-w-7xl">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 anim-fade-up">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 mb-2">
              Optimizations History
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">
              View and manage your past routing solutions
            </p>
          </div>
          <Link
            to="/optimizations/new"
            className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <FaPlus className="text-sm group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-bold tracking-wide">New Optimization</span>
          </Link>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6">{error}</div>}

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : !optimizations || optimizations.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-16 text-center shadow-lg max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <FaRoute className="text-4xl text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">No optimizations found</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Run your first optimization algorithm to see results here.</p>
            <Link to="/optimizations/new" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-colors">
              Let's Start
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {optimizations.map(optimization => (
              <div
                key={optimization._id}
                className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-900 transition-all duration-300 flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded-xl">
                    <FaRoute className="text-xl" />
                  </div>
                  <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <FaCalendarAlt /> {new Date(optimization.date || optimization.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 line-clamp-1" title={optimization.name}>
                  {optimization.name || 'Untitled Optimization'}
                </h3>

                <div className="space-y-3 mb-6 flex-grow">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><FaRoad /> Total Distance</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{Number(optimization?.totalDistance ?? 0).toFixed(2)} km</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><FaClock /> Duration</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {optimization.totalDuration ? `${Math.floor(optimization.totalDuration / 60)} min` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><FaRoute /> Routes</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{optimization.routes ? optimization.routes.length : 0}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-700 mt-auto">
                  <Link
                    to={`/optimizations/${optimization._id}`}
                    className="flex-1 btn flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-semibold py-2.5 px-4 rounded-xl transition-colors"
                  >
                    <FaEye /> Details
                  </Link>
                  <button
                    className="btn flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-semibold py-2.5 px-4 rounded-xl transition-colors"
                    onClick={() => handleDelete(optimization._id)}
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Optimizations;