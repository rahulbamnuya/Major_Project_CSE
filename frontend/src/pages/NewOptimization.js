import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaTruck, FaMapMarkerAlt, FaCogs, FaArrowRight, FaArrowLeft,
  FaCheckCircle, FaSearch, FaPlay, FaRobot, FaLayerGroup,
  FaWeightHanging, FaClock, FaRoute, FaCheck
} from 'react-icons/fa';
import VehicleService from '../services/vehicle.service';
import LocationService from '../services/location.service';
import OptimizationService from '../services/optimization.service';
import Map from '../components/Map';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../context/AuthContext';
import L from 'leaflet';

// --- Loading Screen Component ---
const OptimizationLoadingScreen = ({ progress, currentTask }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length < 3 ? prev + '.' : '');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center text-white">
      <div className="w-full max-w-md p-8 relative">
        {/* Radar Animation */}
        <div className="w-32 h-32 rounded-full border-4 border-indigo-500/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full mb-12 animate-pulse"></div>
        <div className="w-24 h-24 rounded-full border-4 border-indigo-400/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full mb-16 animate-ping"></div>

        <div className="relative z-10 text-center space-y-6 mt-20">
          <div className="inline-block p-4 bg-indigo-600 rounded-2xl shadow-xl hover:scale-110 transition-transform duration-300">
            <FaRobot className="text-4xl animate-bounce" />
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-2">AI Optimization Engine</h2>
            <p className="text-indigo-200 text-sm font-mono tracking-wider h-6">
              {currentTask}{dots}
            </p>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
            <div
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-xs text-slate-400 font-mono mt-8">
            <div className={`p-2 rounded border border-slate-700 ${progress > 10 ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' : ''}`}>
              <FaCheck className="inline mr-1" /> Matrix Calc
            </div>
            <div className={`p-2 rounded border border-slate-700 ${progress > 40 ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' : ''}`}>
              <FaCheck className="inline mr-1" /> Route Gen
            </div>
            <div className={`p-2 rounded border border-slate-700 ${progress > 80 ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' : ''}`}>
              <FaCheck className="inline mr-1" /> Validating
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const NewOptimization = () => {
  const navigate = useNavigate();
  const { currentUser, updateUserPreferences } = useAuth();
  const { notify } = useToast();

  // Data State
  const [vehicles, setVehicles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection State
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);

  // Configuration State
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [algorithm, setAlgorithm] = useState('clarke-wright');
  const [runComparison, setRunComparison] = useState(false);
  const [useTimeWindows, setUseTimeWindows] = useState(true);

  // Execution State
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing...');

  useEffect(() => {
    if (currentUser?.preferences?.defaultAlgorithm) {
      setAlgorithm(currentUser.preferences.defaultAlgorithm);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vehiclesRes, locationsRes] = await Promise.all([
        VehicleService.getAll(),
        LocationService.getAll()
      ]);
      setVehicles(vehiclesRes || []);
      setLocations(locationsRes || []);

      // Auto-select all if reasonable number
      if (locationsRes && locationsRes.length > 0 && locationsRes.length < 50) {
        // Defaults: Select all? No, let user choose.
      }
    } catch (err) {
      notify('Failed to load initial data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---

  const toggleVehicle = (id) => {
    setSelectedVehicles(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const toggleLocation = (id) => {
    setSelectedLocations(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const selectAllLocations = () => {
    if (selectedLocations.length === locations.length) {
      setSelectedLocations([]);
    } else {
      setSelectedLocations(locations.map(l => l._id));
    }
  };

  const handleNext = () => {
    if (step === 1 && selectedVehicles.length === 0) {
      notify('Please select at least one vehicle', 'error');
      return;
    }
    if (step === 2 && selectedLocations.length === 0) {
      notify('Please select at least one location', 'error');
      return;
    }
    if (step === 2) {
      // Validate depot presence
      const hasDepot = locations.some(l => selectedLocations.includes(l._id) && l.isDepot);
      if (!hasDepot) {
        notify('You must select at least one Depot location (Start Point)', 'warning', { autoClose: 5000 });
        return;
      }
    }
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleOptimize = async () => {
    if (!name.trim()) return notify('Please name this optimization', 'error');

    setOptimizing(true);
    setProgress(0);
    setLoadingText('Initializing parameters...');

    try {
      // Simulation of progress steps
      const progressTimer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.floor(Math.random() * 10);
        });
        setLoadingText(prev => {
          const msgs = ['Calculating Distance Matrix...', 'Solving VRP...', 'Optimizing Stops...', ' verifying constraints...'];
          return msgs[Math.floor(Math.random() * msgs.length)];
        });
      }, 800);

      const payload = {
        name: name.trim(),
        vehicleIds: selectedVehicles,
        locationIds: selectedLocations,
        algorithm,
        runComparison,
        useTimeWindows
      };

      const response = await OptimizationService.create(payload);

      clearInterval(progressTimer);
      setProgress(100);
      setLoadingText('Finalizing...');

      // Save preference
      if (!runComparison && currentUser?.preferences?.defaultAlgorithm !== algorithm) {
        updateUserPreferences({ defaultAlgorithm: algorithm }).catch(console.warn);
      }

      setTimeout(() => {
        navigate(`/optimizations/${response._id}`);
        notify('Optimization completed successfully!', 'success');
      }, 800);

    } catch (err) {
      setOptimizing(false);
      const msg = err.response?.data?.msg || err.message || 'Optimization failed';
      notify(msg, 'error', { autoClose: 5000 });
    }
  };

  // --- Render Steps ---

  const renderStep1 = () => (
    <div className="space-y-6 anim-fade-up">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Select Your Fleet</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Choose available vehicles for this route.</p>
        </div>
        <button
          onClick={() => setSelectedVehicles(selectedVehicles.length === vehicles.length ? [] : vehicles.map(v => v._id))}
          className="text-sm font-semibold text-blue-600 hover:text-blue-700 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg transition-colors"
        >
          {selectedVehicles.length === vehicles.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
          <FaTruck className="text-4xl text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No vehicles available.</p>
          <button onClick={() => navigate('/vehicles/add')} className="mt-4 text-blue-600 font-bold hover:underline">Add a Vehicle first</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vehicles.map(vehicle => {
            const isSelected = selectedVehicles.includes(vehicle._id);
            return (
              <div
                key={vehicle._id}
                onClick={() => toggleVehicle(vehicle._id)}
                className={`
                                cursor-pointer relative p-5 rounded-2xl border-2 transition-all duration-200
                                ${isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-md transform scale-[1.02]'
                    : 'bg-white dark:bg-slate-800 border-transparent shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-slate-600'
                  }
                            `}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                    <FaTruck />
                  </div>
                  {isSelected && <FaCheckCircle className="text-blue-500 text-xl" />}
                </div>
                <h3 className="font-bold text-slate-800 dark:text-white mb-1">{vehicle.name}</h3>
                <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Cap: {vehicle.capacity}</span>
                  <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Qty: {vehicle.count}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );

  const renderStep2 = () => {
    const selectedLocObjs = locations.filter(l => selectedLocations.includes(l._id));

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)] min-h-[500px] anim-fade-up">
        {/* List Selection */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-bold text-slate-700 dark:text-slate-300">Locations ({selectedLocations.length})</h3>
            <button onClick={selectAllLocations} className="text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg">
              {selectedLocations.length === locations.length ? 'None' : 'All'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {locations.map(loc => {
              const isSelected = selectedLocations.includes(loc._id);
              return (
                <div
                  key={loc._id}
                  onClick={() => toggleLocation(loc._id)}
                  className={`
                                    p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors
                                    ${isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
                      : 'bg-white dark:bg-slate-800/50 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'
                    }
                                `}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center text-sm ${loc.isDepot ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                      {loc.isDepot ? <FaLayerGroup /> : <FaMapMarkerAlt />}
                    </div>
                    <div className="truncate">
                      <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-300'}`}>{loc.name}</p>
                      <p className="text-xs text-slate-400 truncate">{loc.demand} units • {loc.isDepot ? 'Depot' : 'Stop'}</p>
                    </div>
                  </div>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0"></div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Map Preview */}
        <div className="lg:col-span-2 bg-slate-100 dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner relative">
          <Map locations={selectedLocObjs} />

          {/* Floating Stats */}
          <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-[400] text-xs">
            <p>Selected Demand: <strong>{selectedLocObjs.reduce((s, l) => s + (l.demand || 0), 0)}</strong></p>
            <p>Depots: <strong>{selectedLocObjs.filter(l => l.isDepot).length}</strong></p>
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    // Validation Check for Capacity
    const totalCapacity = vehicles.filter(v => selectedVehicles.includes(v._id)).reduce((s, v) => s + (v.capacity * (v.count || 1)), 0);
    const totalDemand = locations.filter(l => selectedLocations.includes(l._id)).reduce((s, l) => s + (l.demand || 0), 0);
    const isCapacityIssue = totalCapacity < totalDemand;

    return (
      <div className="max-w-2xl mx-auto space-y-8 anim-fade-up pb-20">

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Optimization Configuration</h2>
          <p className="text-slate-500">Fine tune your algorithm settings before launch.</p>
        </div>

        {/* Warning Cards */}
        {isCapacityIssue && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4 rounded-xl flex items-start gap-3">
            <FaWeightHanging className="text-amber-500 mt-1" />
            <div>
              <h4 className="font-bold text-amber-700 dark:text-amber-400">Capacity Warning</h4>
              <p className="text-sm text-amber-600 dark:text-amber-500">
                Total Demand ({totalDemand}) exceeds selected Vehicle Capacity ({totalCapacity}).
                Some orders may be left unassigned.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Name Input */}
          <div className="group">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Optimization Name</label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monday Morning Deliveries"
                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pl-11 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-lg"
              />
              <FaRoute className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
          </div>

          {/* Algorithm Selection */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2"><FaCogs className="text-slate-400" /> Solving Strategy</h3>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={runComparison} onChange={(e) => setRunComparison(e.target.checked)} className="rounded accent-indigo-600 w-4 h-4" />
                Run AI Comparison Mode
              </label>
            </div>

            {!runComparison ? (
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="clarke-wright">Clarke-Wright Savings (Standard)</option>
                <option value="nearest-neighbor">Nearest Neighbor (Fastest)</option>
                <option value="genetic">Genetic Algorithm (High Quality)</option>
                <option value="ant-colony">Ant Colony Optimization</option>
                <option value="or-tools">Google OR-Tools (Production Grade)</option>
              </select>
            ) : (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-xl text-sm border border-indigo-100 dark:border-indigo-800">
                We will run all algorithms in parallel and select the one with the lowest cost and best efficiency automatically.
              </div>
            )}
          </div>

          {/* Additional Settings */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => setUseTimeWindows(!useTimeWindows)}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${useTimeWindows ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                <FaClock />
              </div>
              <div>
                <h4 className="font-bold text-sm">Time Window Constraints</h4>
                <p className="text-xs text-slate-500">Strictly enforce arrival/departure times</p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${useTimeWindows ? 'bg-blue-500' : 'bg-slate-300'}`}>
              <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${useTimeWindows ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </div>
          </div>

        </div>
      </div>
    );
  };

  // --- Main Layout ---

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col font-sans">
      {optimizing && <OptimizationLoadingScreen progress={progress} currentTask={loadingText} />}

      {/* Top Navigation Stepper */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {[
            { num: 1, label: 'Vehicles', icon: FaTruck },
            { num: 2, label: 'Locations', icon: FaMapMarkerAlt },
            { num: 3, label: 'Launch', icon: FaPlay }
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <div className={`flex items-center gap-2 ${step === s.num ? 'text-blue-600 dark:text-blue-400' : step > s.num ? 'text-green-500' : 'text-slate-300'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${step === s.num ? 'border-current bg-blue-50 dark:bg-blue-900/20' : step > s.num ? 'bg-green-100 border-green-500' : 'border-slate-200'}`}>
                  {step > s.num ? <FaCheck /> : s.num}
                </div>
                <span className="hidden md:inline font-bold text-sm">{s.label}</span>
              </div>
              {idx < 2 && <div className="w-12 h-0.5 bg-slate-200 mx-4 hidden sm:block"></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 container mx-auto px-4 md:px-8 py-8 max-w-6xl">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>

      {/* Persistent Footer Actions */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-6 sticky bottom-0 z-20">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors ${step === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}
          >
            <FaArrowLeft /> Back
          </button>

          <div className="flex gap-4">
            {step < 3 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                Next Step <FaArrowRight />
              </button>
            ) : (
              <button
                onClick={handleOptimize}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-10 py-3 rounded-xl font-bold shadow-xl shadow-emerald-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-lg"
              >
                <FaPlay /> Start Optimization
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default NewOptimization;