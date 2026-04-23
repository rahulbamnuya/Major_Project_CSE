import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { FaSave, FaCog, FaTruck, FaMoon, FaSun, FaRoad } from 'react-icons/fa';

const DEFAULTS = {
  smallThreshold: 1000,
  mediumThreshold: 4000,
};

export const getVehicleThresholds = () => ({
  smallThreshold: parseInt(localStorage.getItem('vrp_small_threshold') || DEFAULTS.smallThreshold),
  mediumThreshold: parseInt(localStorage.getItem('vrp_medium_threshold') || DEFAULTS.mediumThreshold),
});

const Settings = () => {
  const { currentUser, updateUserPreferences } = useAuth();
  const { notify } = useToast();

  const [theme, setTheme] = useState('light');
  const [algorithm, setAlgorithm] = useState('or-tools-hybrid');
  const [smallThreshold, setSmallThreshold] = useState(DEFAULTS.smallThreshold);
  const [mediumThreshold, setMediumThreshold] = useState(DEFAULTS.mediumThreshold);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUser?.preferences) {
      setTheme(currentUser.preferences.theme || 'light');
      setAlgorithm(currentUser.preferences.defaultAlgorithm || 'or-tools-hybrid');
    }
    // Load thresholds from localStorage
    setSmallThreshold(parseInt(localStorage.getItem('vrp_small_threshold') || DEFAULTS.smallThreshold));
    setMediumThreshold(parseInt(localStorage.getItem('vrp_medium_threshold') || DEFAULTS.mediumThreshold));
  }, [currentUser]);

  const onSave = async () => {
    if (smallThreshold >= mediumThreshold) {
      notify('Small threshold must be less than Medium threshold', 'error');
      return;
    }
    setSaving(true);
    try {
      // Save thresholds to localStorage (no DB needed, purely a client-side routing config)
      localStorage.setItem('vrp_small_threshold', smallThreshold);
      localStorage.setItem('vrp_medium_threshold', mediumThreshold);

      // Save other preferences to user profile in DB
      await updateUserPreferences({ theme, defaultAlgorithm: algorithm });
      notify('Settings saved successfully', 'success');
    } catch (err) {
      notify('Failed to save settings', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    setSmallThreshold(DEFAULTS.smallThreshold);
    setMediumThreshold(DEFAULTS.mediumThreshold);
    notify('Thresholds reset to defaults', 'info');
  };

  const getVehicleClass = (cap) => {
    if (cap <= smallThreshold) return { label: 'SMALL', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' };
    if (cap <= mediumThreshold) return { label: 'MEDIUM', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' };
    return { label: 'LARGE', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' };
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 font-sans text-slate-800 dark:text-slate-100">
      <div className="container mx-auto px-6 py-8 max-w-3xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <FaCog className="text-indigo-500" /> System Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Configure routing engine behavior and fleet classification rules.</p>
        </div>

        <div className="space-y-6">

          {/* Appearance */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-lg border border-slate-100 dark:border-slate-700">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              {theme === 'dark' ? <FaMoon className="text-indigo-400" /> : <FaSun className="text-amber-500" />} Appearance
            </h2>
            <div className="flex gap-3">
              {['light', 'dark'].map(t => (
                <button key={t} onClick={() => setTheme(t)}
                  className={`flex-1 py-3 rounded-xl font-bold capitalize border-2 transition-all ${theme === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Default Algorithm */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-lg border border-slate-100 dark:border-slate-700">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <FaCog className="text-slate-400" /> Default Routing Algorithm
            </h2>
            <select value={algorithm} onChange={e => setAlgorithm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500">
              <optgroup label="Baseline Heuristics">
                <option value="clarke-wright">Modified Clarke-Wright</option>
                <option value="nearest-neighbor">Nearest Neighbor</option>
                <option value="genetic">Genetic Algorithm</option>
                <option value="ant-colony">Ant Colony Optimization</option>
              </optgroup>
              <optgroup label="Advanced Geo-VRP Engine">
                <option value="or-tools-hybrid">✦ Geo-VRP Hybrid Iterative (Recommended)</option>
                <option value="or-tools-pre">✦ Geo-VRP Heuristic Fast</option>
                <option value="or-tools">✦ Geo-VRP Standard</option>
              </optgroup>
            </select>
          </div>

          {/* Vehicle Classification Thresholds */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-lg border border-slate-100 dark:border-slate-700">
            <div className="flex justify-between items-center mb-1">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <FaTruck className="text-indigo-500" /> Vehicle Size Classification
              </h2>
              <button onClick={onReset} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">Reset Defaults</button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              These thresholds determine which roads a vehicle can enter. Based on Indian municipal transport regulations, vehicles exceeding the threshold are restricted from <span className="font-bold text-red-500">NARROW</span> roads.
            </p>

            {/* SMALL threshold */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-emerald-600">SMALL Vehicle (≤ threshold → Alleys allowed)</label>
                <span className="font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-lg">{smallThreshold.toLocaleString()} kg</span>
              </div>
              <input type="range" min="500" max="2000" step="50" value={smallThreshold}
                onChange={e => setSmallThreshold(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-emerald-500 bg-slate-200 dark:bg-slate-700" />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>500 kg</span><span>2,000 kg</span>
              </div>
            </div>

            {/* MEDIUM threshold */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-amber-600">MEDIUM Vehicle (≤ threshold → Standard streets)</label>
                <span className="font-mono font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-3 py-1 rounded-lg">{mediumThreshold.toLocaleString()} kg</span>
              </div>
              <input type="range" min="1500" max="8000" step="100" value={mediumThreshold}
                onChange={e => setMediumThreshold(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-amber-500 bg-slate-200 dark:bg-slate-700" />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>1,500 kg</span><span>8,000 kg</span>
              </div>
            </div>

            {/* Live Classification Preview */}
            <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
              <p className="text-xs font-bold uppercase text-slate-400 mb-3 flex items-center gap-2"><FaRoad /> Live Preview — Sample Fleet</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Tata Ace', cap: 750 },
                  { name: 'Mahindra Supro', cap: 900 },
                  { name: 'Tata 407', cap: 2500 },
                  { name: 'Eicher Pro', cap: 5000 },
                  { name: 'BharatBenz 1215', cap: 10000 },
                  { name: 'Ashok Leyland', cap: 15000 },
                ].map(v => {
                  const cls = getVehicleClass(v.cap);
                  return (
                    <div key={v.name} className={`flex justify-between items-center px-3 py-2 rounded-xl ${cls.bg}`}>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{v.name} ({v.cap.toLocaleString()} kg)</span>
                      <span className={`text-xs font-bold ${cls.color}`}>{cls.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button onClick={onSave} disabled={saving}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 text-lg">
            {saving ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <><FaSave /> Save All Settings</>}
          </button>

        </div>
      </div>
    </div>
  );
};

export default Settings;