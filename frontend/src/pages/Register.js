import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUser, FaEnvelope, FaLock, FaArrowRight, FaRocket, FaShieldAlt, FaCheck } from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    password2: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useContext(AuthContext);
  const { notify } = useToast();
  const navigate = useNavigate();

  const { name, email, password, password2 } = formData;

  const onChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== password2) {
      setError('Passwords do not match');
      notify('Passwords do not match', 'error');
      setLoading(false);
      return;
    }

    try {
      await register(name, email, password);
      notify('Account created successfully! Welcome aboard.', 'success');
      // Delay slightly for effect
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err) {
      const errorMsg = err.response?.data?.msg || 'Registration failed. Please try again.';
      setError(errorMsg);
      // notify(errorMsg, 'error'); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-row-reverse">

      {/* Right: Decoration (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-bl from-blue-600 to-indigo-700 overflow-hidden items-center justify-center p-12 text-white">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl translate-x-10 -translate-y-10"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-20 translate-y-20"></div>

        <div className="relative z-10 max-w-lg space-y-8">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 shadow-xl">
            <FaRocket className="text-3xl text-yellow-300" />
          </div>
          <h1 className="text-5xl font-extrabold leading-tight">
            Start Your Journey
          </h1>
          <p className="text-lg text-indigo-100 font-medium leading-relaxed opacity-90">
            Join thousands of logistics managers optimizing their routes today. Create an account to unlock advanced AI algorithms and fleet analytics.
          </p>

          <ul className="space-y-4 mt-4">
            {['Unlimited Optimization Runs', 'Advanced Fleet Analytics', 'Real-time Cost Estimations', 'Driver Manifest Generation'].map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-400/20 flex items-center justify-center">
                  <FaCheck className="text-xs text-green-300" />
                </div>
                <span className="font-semibold">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Left: Registration Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12 relative">

        <Link to="/" className="absolute top-8 left-8 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
          &larr; Back to Home
        </Link>

        <div className="w-full max-w-md space-y-8 anim-fade-up">

          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Create Account</h2>
            <p className="text-slate-500 dark:text-slate-400">Sign up for free and start optimizing.</p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium border border-red-100 dark:border-red-800 animate-pulse">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">

            {/* Name Input */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="name">Full Name</label>
              <div className="relative group">
                <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={name}
                  onChange={onChange}
                  required
                  placeholder="John Doe"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pl-11 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="email">Email Address</label>
              <div className="relative group">
                <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={onChange}
                  required
                  placeholder="name@company.com"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pl-11 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="password">Password</label>
                <div className="relative group">
                  <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={onChange}
                    required
                    minLength="6"
                    placeholder="Min 6 chars"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pl-11 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="password2">Confirm</label>
                <div className="relative group">
                  <FaShieldAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="password"
                    id="password2"
                    name="password2"
                    value={password2}
                    onChange={onChange}
                    required
                    minLength="6"
                    placeholder="Re-enter password"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pl-11 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" required id="ts" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <label htmlFor="ts" className="text-sm text-slate-500">I agree to the <a href="#" className="text-blue-600 font-bold hover:underline">Terms & Conditions</a></label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>Create Account <FaArrowRight /></>
              )}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm">
            Already have an account? <Link to="/login" className="text-blue-600 font-bold hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;