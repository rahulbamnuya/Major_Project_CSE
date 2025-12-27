import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaEnvelope, FaLock, FaSignInAlt, FaGoogle, FaGithub, FaLeaf, FaArrowRight, FaTruck } from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '1234qwer@gmail.com',
    password: '123123'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const { notify } = useToast();
  const navigate = useNavigate();

  const { email, password } = formData;

  const onChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      // Wait a moment for context to update (optional) but notify immediately
      notify('Welcome back! Launching your dashboard...', 'success');
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (err) {
      const errorMsg = err.response?.data?.msg || 'Invalid credentials. Please try again.';
      setError(errorMsg);
      // notify(errorMsg, 'error'); // Optional redundancy
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">

      {/* Left: Branding & Decoration (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-indigo-600 to-violet-700 overflow-hidden items-center justify-center p-12 text-white">
        {/* Abstract shapes */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-10 -translate-y-10"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-20 translate-y-20"></div>

        <div className="relative z-10 max-w-lg space-y-6">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 shadow-xl">
            <FaLeaf className="text-3xl text-green-300" />
          </div>
          <h1 className="text-5xl font-extrabold leading-tight">
            Optimize Your Logistics Chain
          </h1>
          <p className="text-lg text-indigo-100 font-medium leading-relaxed opacity-90">
            Unlock the power of AI-driven route optimization. Reduce fuel costs, improve delivery times, and manage your entire fleet in one premium dashboard.
          </p>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
              <h3 className="font-bold text-2xl mb-1">30%</h3>
              <p className="text-sm opacity-80">Avg. Fuel Savings</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
              <h3 className="font-bold text-2xl mb-1">2x</h3>
              <p className="text-sm opacity-80">Faster Planning</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12 relative">

        {/* Back Action */}
        <Link to="/" className="absolute top-8 right-8 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
          Back to Home
        </Link>

        <div className="w-full max-w-md space-y-8 anim-fade-up">

          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Welcome Back</h2>
            <p className="text-slate-500 dark:text-slate-400">Please enter your details to sign in.</p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium border border-red-100 dark:border-red-800 animate-pulse">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">

            {/* Email Input */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="email">Email Address</label>
              <div className="relative group">
                <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={onChange}
                  required
                  placeholder="name@company.com"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pl-11 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="password">Password</label>
                <a href="#" className="text-xs font-bold text-indigo-600 hover:underline">Forgot Password?</a>
              </div>
              <div className="relative group">
                <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={onChange}
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pl-11 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>Sign In <FaArrowRight /></>
              )}
            </button>
          </form>

          {/* IDP Login (Visual Only) */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-50 dark:bg-slate-900 text-slate-500">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-colors">
              <FaGoogle className="text-red-500" /> Google
            </button>
            <button className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-colors">
              <FaGithub className="text-slate-900 dark:text-white" /> GitHub
            </button>
          </div>

          <Link to="/portal" className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-colors">
            <FaTruck /> Driver Login Portal
          </Link>

          <p className="text-center text-slate-500 text-sm">
            Don't have an account yet? <Link to="/register" className="text-indigo-600 font-bold hover:underline">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;