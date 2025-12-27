import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FaTruck,
  FaSignOutAlt,
  FaUserCircle,
  FaBars,
  FaTimes,
  FaSun,
  FaMoon,
  FaCog,
  FaTachometerAlt,
  FaRoute,
  FaMapMarkedAlt,
  FaIdCard,
  FaChevronDown,
  FaLeaf
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/ToastProvider';

const Navbar = () => {
  const { currentUser, logout, updateUserPreferences } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus when location changes
  useEffect(() => {
    setIsOpen(false);
    setUserMenuOpen(false);
  }, [location]);

  const handleLogout = () => {
    logout();
    notify('Logged out successfully', 'info');
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <FaTachometerAlt /> },
    { path: '/optimizations', label: 'Optimizations', icon: <FaRoute /> },
    { path: '/vehicles', label: 'Vehicles', icon: <FaTruck /> },
    { path: '/locations', label: 'Locations', icon: <FaMapMarkedAlt /> },
    { path: '/drivers', label: 'Drivers', icon: <FaIdCard /> }, // Added Drivers
  ];

  const handleThemeToggle = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    toggleTheme();

    if (currentUser) {
      setSavingPrefs(true);
      try {
        await updateUserPreferences({ theme: newTheme });
      } finally {
        setSavingPrefs(false);
      }
    }
  };

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 border-b ${scrolled
          ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-sm py-2'
          : 'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-transparent py-4'
          }`}
      >
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex justify-between items-center">

            {/* Logo Section */}
            <Link to="/" className="flex items-center gap-3 group relative z-50">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform duration-300">
                <FaLeaf className="text-lg" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Route<span className="text-indigo-600 dark:text-indigo-400">Optimizer</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            {currentUser && (
              <div className="hidden lg:flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/50 backdrop-blur-sm">
                {navItems.map((item) => {
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`
                        relative px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all duration-300
                        ${isActive
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                        }
                      `}
                    >
                      <span className={`text-lg ${isActive ? 'text-indigo-500 dark:text-indigo-400' : 'opacity-70'}`}>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Right Actions */}
            <div className="flex items-center gap-2 relative z-50">

              {/* Theme Toggle */}
              <button
                onClick={handleThemeToggle}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              >
                {savingPrefs ? <FaCog className="animate-spin" /> : theme === 'light' ? <FaMoon /> : <FaSun className="text-amber-400" />}
              </button>

              {currentUser ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  >
                    <div className="hidden md:block text-right mr-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                        {currentUser.name?.split(' ')[0] || 'User'}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium capitalize">
                        {currentUser.role || 'Admin'}
                      </p>
                    </div>
                    <div className="w-9 h-9 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white shadow-md ring-2 ring-white dark:ring-slate-900">
                      <span className="text-sm font-bold">{currentUser.name?.charAt(0) || 'U'}</span>
                    </div>
                    <FaChevronDown className={`text-xs text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)}></div>
                      <div className="absolute right-0 top-full mt-3 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-20 anim-fade-up">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Currently logged in as</p>
                          <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                        </div>
                        <div className="p-2">
                          <Link to="/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors">
                            <FaCog className="text-slate-400" /> Settings
                          </Link>
                          <Link to="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors">
                            <FaUserCircle className="text-slate-400" /> My Profile
                          </Link>
                          <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                          >
                            <FaSignOutAlt /> Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="hidden md:flex gap-3 ml-2">
                  <Link to="/login" className="px-5 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    Log In
                  </Link>
                  <Link to="/register" className="px-5 py-2 text-sm font-bold text-white bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 rounded-xl shadow-lg transition-transform active:scale-95">
                    Start Free
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                className="lg:hidden p-2 text-slate-600 dark:text-slate-300"
                onClick={() => setIsOpen(!isOpen)}
              >
                {isOpen ? <FaTimes className="text-xl" /> : <FaBars className="text-xl" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Filter / Backdrop */}
        <div
          className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsOpen(false)}
        ></div>

        {/* Mobile Menu Content */}
        <div className={`fixed top-[70px] left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl z-50 lg:hidden transform transition-all duration-300 ${isOpen ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
          <div className="p-4 space-y-2">
            {currentUser ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`
                        flex flex-col items-center justify-center p-4 rounded-xl text-center border transition-all
                        ${location.pathname.startsWith(item.path)
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-600 dark:text-slate-400'
                        }
                      `}
                    >
                      <span className="text-2xl mb-1">{item.icon}</span>
                      <span className="text-xs font-bold">{item.label}</span>
                    </Link>
                  ))}
                </div>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 p-3 text-red-600 font-bold bg-red-50 dark:bg-red-900/10 rounded-xl"
                >
                  <FaSignOutAlt /> Log Out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <Link to="/login" className="w-full py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-center font-bold text-slate-700 dark:text-slate-200">
                  Log In
                </Link>
                <Link to="/register" className="w-full py-3 bg-indigo-600 rounded-xl text-center font-bold text-white">
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
      {/* Spacer for fixed navbar */}
      <div className="h-28"></div>
    </>
  );
};

export default Navbar;
