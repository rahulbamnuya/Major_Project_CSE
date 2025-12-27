import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FaArrowLeft,
  FaTrophy,
  FaRoute,
  FaCalculator,
  FaTruck,
  FaGasPump,
  FaUserCog,
  FaChartPie,
  FaBalanceScale,
  FaClock
} from "react-icons/fa";
import OptimizationService from "../services/optimization.service";
import { useToast } from "../components/ToastProvider";
import LoadingSkeleton from "../components/LoadingSkeleton";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";

const DEFAULT_FUEL_COST_PER_KM = 10;
const DEFAULT_DRIVER_COST_PER_KM = 8;

// Custom Chart Tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 text-sm">
        <p className="font-bold text-slate-800 dark:text-white mb-2 text-lg border-b border-slate-100 dark:border-slate-700 pb-1">{label}</p>
        <div className="space-y-1">
          <p className="flex justify-between gap-4">
            <span className="text-indigo-600 font-medium">Total Cost:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">₹{Number(data['Total Cost'] || 0).toFixed(2)}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-emerald-500 font-medium">Fuel Cost:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">₹{Number(data['Fuel Cost'] || 0).toFixed(2)}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-amber-500 font-medium">Driver Cost:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">₹{Number(data['Driver Cost'] || 0).toFixed(2)}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-rose-500 font-medium">Distance:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">{Number(data['Distance'] || 0).toFixed(2)} km</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

const AlgorithmComparison = () => {
  const { id } = useParams();
  const [optimization, setOptimization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAlgorithmIndex, setSelectedAlgorithmIndex] = useState(null);
  const { notify } = useToast();

  useEffect(() => {
    const fetchOptimization = async () => {
      try {
        setLoading(true);
        const data = await OptimizationService.get(id);
        setOptimization(data);
      } catch (err) {
        console.error("Fetch optimization error:", err);
        const errorMsg = "Failed to load optimization data";
        setError(errorMsg);
        notify(errorMsg, "error");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchOptimization();
  }, [id, notify]);

  // Process results logic (kept same as before, just memoized)
  const processedResults = useMemo(() => {
    if (!optimization?.algorithmResults || !optimization?.vehicles) return [];

    const vehicleCostMap = new Map();
    optimization.vehicles.forEach((v) => {
      vehicleCostMap.set(v._id.toString(), {
        fuelCost: v.fuel_cost_per_km || DEFAULT_FUEL_COST_PER_KM,
        driverCost: v.driver_cost_per_km || DEFAULT_DRIVER_COST_PER_KM,
      });
    });

    return optimization.algorithmResults.map((result) => {
      if (result.error) return result;

      let totalFuelCost = 0;
      let totalDriverCost = 0;
      let totalDistance = 0;
      let totalStops = 0;
      const uniqueVehicles = new Set();
      // Calculate realistic duration if not present (simple avg speed assumption 40km/h)
      // This is for normalization in radar chart if needed
      let totalDurationMinutes = 0;

      result.routes?.forEach((route) => {
        if (route.vehicle) {
          uniqueVehicles.add(route.vehicleName);
          totalDistance += route.distance || 0;
          totalStops += route.stops?.length || 0;
          totalDurationMinutes += route.duration ? (route.duration / 60) : ((route.distance / 40) * 60);

          const costs = vehicleCostMap.get(route.vehicle.toString());
          if (costs) {
            totalFuelCost += (route.distance || 0) * costs.fuelCost;
            totalDriverCost += (route.distance || 0) * costs.driverCost;
          }
        }
      });

      return {
        ...result,
        totalFuelCost,
        totalDriverCost,
        totalCost: totalFuelCost + totalDriverCost,
        vehiclesUsedCount: uniqueVehicles.size,
        totalDistance,
        totalStops,
        totalDurationMinutes,
        avgCostPerKm: totalDistance > 0 ? (totalFuelCost + totalDriverCost) / totalDistance : 0,
        // Normalize 0-100 score (higher is worse for costs/distance)
        scoreDistance: totalDistance,
        scoreCost: totalFuelCost + totalDriverCost
      };
    }).filter(r => !r.error); // Filter out failed runs for charts
  }, [optimization]);

  // Find best algorithm
  const { bestAlgorithm, bestAlgorithmIndex } = useMemo(() => {
    if (processedResults.length === 0)
      return { bestAlgorithm: null, bestAlgorithmIndex: null };

    const valid = processedResults.filter((r) => !r.error);
    if (valid.length === 0)
      return { bestAlgorithm: null, bestAlgorithmIndex: null };

    const best = valid.reduce((min, curr) =>
      (curr.totalCost || Infinity) < (min.totalCost || Infinity) ? curr : min
    );
    const bestIndex = processedResults.findIndex(
      (r) => r.algorithmKey === best.algorithmKey
    );
    return { bestAlgorithm: best, bestAlgorithmIndex: bestIndex };
  }, [processedResults]);

  useEffect(() => {
    if (bestAlgorithmIndex !== null && selectedAlgorithmIndex === null) {
      setSelectedAlgorithmIndex(bestAlgorithmIndex);
    } else if (processedResults.length > 0 && selectedAlgorithmIndex === null) {
      setSelectedAlgorithmIndex(0);
    }
  }, [bestAlgorithmIndex, processedResults, selectedAlgorithmIndex]);

  const formatDistance = (d) => `${Number(d || 0).toFixed(2)} km`;
  const formatCurrency = (a) => `₹${Number(a || 0).toFixed(2)}`;

  // Format Data for Radar Chart (Accessing relative performance)
  const radarData = useMemo(() => {
    if (!processedResults.length) return [];

    // Find max values for normalization
    const maxCost = Math.max(...processedResults.map(r => r.totalCost));
    const maxDist = Math.max(...processedResults.map(r => r.totalDistance));
    const maxDuration = Math.max(...processedResults.map(r => r.totalDurationMinutes));

    // We only take top 3 or selected + best for clarity if too many
    return processedResults.map(r => ({
      subject: r.algorithm,
      // Invert so 100 is "Best" (lowest cost/distance)
      Cost: Math.round(((maxCost - r.totalCost) / maxCost) * 100) + 20, // baseline padding
      Efficiency: Math.round(((maxDist - r.totalDistance) / maxDist) * 100) + 20,
      Time: Math.round(((maxDuration - r.totalDurationMinutes) / maxDuration) * 100) + 20,
      fullMark: 150
    }));
  }, [processedResults]);


  const chartData = processedResults.map((r) => ({
    name: r.algorithm,
    "Total Cost": r.totalCost,
    "Fuel Cost": r.totalFuelCost,
    "Driver Cost": r.totalDriverCost,
    "Distance": r.totalDistance,
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 pt-8 px-6 space-y-8">
        <LoadingSkeleton lines={2} className="w-1/3 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="h-80 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
          <div className="h-80 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
        </div>
        <LoadingSkeleton lines={5} />
      </div>
    )
  }

  if (error || !optimization) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
        <h2 className="text-2xl font-bold mb-4">Optimization Not Found</h2>
        <p className="mb-6 text-slate-500">{error}</p>
        <Link to="/optimizations" className="btn btn-primary px-6 py-2 rounded-lg">
          Back to Optimizations
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 font-sans text-slate-800 dark:text-slate-100">
      <div className="container mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 anim-fade-up">
          <div>
            <Link to={`/optimizations/${id}`} className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-2 transition-colors">
              <FaArrowLeft className="text-xs" /> Back to Details
            </Link>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              Algorithm Analysis
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Comparing performance metrics for {optimization.name}</p>
          </div>

          {bestAlgorithm && (
            <div className="flex items-center gap-4 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl shadow-sm">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-sm text-amber-500">
                <FaTrophy className="text-xl" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Top Performer</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{bestAlgorithm.algorithm}</p>
              </div>
              <div className="h-8 w-px bg-amber-200 dark:bg-amber-800 mx-2"></div>
              <div className="text-right">
                <p className="text-xs text-amber-600 dark:text-amber-400">Savings</p>
                <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(bestAlgorithm.totalCost)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-10">
          {/* Main Bar Chart */}
          <div className="xl:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FaChartPie className="text-indigo-500" /> Cost Breakdown
              </h3>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barSize={32}>
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="Total Cost" fill="#6366f1" radius={[4, 4, 0, 0]} name="Total Cost" />
                  <Bar dataKey="Fuel Cost" fill="#10b981" radius={[4, 4, 0, 0]} name="Fuel" stackId="a" hide />
                  <Bar dataKey="Driver Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Driver" stackId="a" hide />
                  {/* Hidden stack bars just for tooltip data availability if needed, main bar is Total Cost for cleaner comparison */}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Radar Chart for Multi-dimensional comparison */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-xl flex flex-col items-center justify-center">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2 w-full">
              <FaBalanceScale className="text-pink-500" /> Efficiency Score
            </h3>
            <p className="text-xs text-slate-500 mb-4 w-full">Higher is better (Normalized)</p>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                  <Radar name="Performance" dataKey="Efficiency" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Radar name="Cost Effectiveness" dataKey="Cost" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                  <Tooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Detailed Table Section */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-xl overflow-hidden mb-10">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <h3 className="text-lg font-bold">Detailed Metrics Table</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-4 rounded-tl-lg">Algorithm</th>
                  <th className="p-4">Distance</th>
                  <th className="p-4">Total Cost</th>
                  <th className="p-4">Stops</th>
                  <th className="p-4">Vehicles</th>
                  <th className="p-4">Cost/Km</th>
                  <th className="p-4 rounded-tr-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {processedResults.map((result, idx) => {
                  const isBest = bestAlgorithm && result.algorithmKey === bestAlgorithm.algorithmKey;
                  const isSelected = selectedAlgorithmIndex === idx;

                  return (
                    <tr
                      key={idx}
                      onClick={() => setSelectedAlgorithmIndex(idx)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                    >
                      <td className="p-4 font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        {result.algorithm}
                        {isBest && <FaTrophy className="text-amber-500" title="Best Result" />}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300 font-mono">{formatDistance(result.totalDistance)}</td>
                      <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400 font-mono">{formatCurrency(result.totalCost)}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">{result.totalStops}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">{result.vehiclesUsedCount} / {optimization.vehicles.length}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-300 font-mono">{formatCurrency(result.avgCostPerKm)}</td>
                      <td className="p-4">
                        <button className={`text-xs px-3 py-1 rounded-full border transition-colors ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 hover:border-indigo-500 hover:text-indigo-500'}`}>
                          {isSelected ? 'Viewing' : 'View Details'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Algorithm Details Card */}
        {processedResults[selectedAlgorithmIndex] && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 anim-fade-up">
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
                    <FaRoute className="text-xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Route Composition</h3>
                    <p className="text-sm text-slate-500">Breakdown for {processedResults[selectedAlgorithmIndex].algorithm}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {processedResults[selectedAlgorithmIndex].routes?.map((route, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-white dark:bg-slate-600 flex items-center justify-center text-slate-400 font-bold shadow-sm">
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{route.vehicleName}</p>
                          <p className="text-xs text-slate-500">{route.stops?.length || 0} stops</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">{formatDistance(route.distance)}</p>
                        <p className="text-xs text-slate-400">Distance</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-500/20">
                <p className="text-indigo-100 font-medium mb-1">Total Cost</p>
                <h3 className="text-3xl font-bold mb-4">{formatCurrency(processedResults[selectedAlgorithmIndex].totalCost)}</h3>
                <div className="flex gap-2 text-xs opacity-90">
                  <span className="bg-white/20 px-2 py-1 rounded">Fuel: {formatCurrency(processedResults[selectedAlgorithmIndex].totalFuelCost)}</span>
                  <span className="bg-white/20 px-2 py-1 rounded">Driver: {formatCurrency(processedResults[selectedAlgorithmIndex].totalDriverCost)}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-lg flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Efficiency</p>
                  <h3 className="text-2xl font-bold font-mono">{formatCurrency(processedResults[selectedAlgorithmIndex].avgCostPerKm)}<span className="text-sm text-slate-400 font-sans font-normal ml-1">/km</span></h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 text-xl">
                  <FaCalculator />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-lg flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Est. Duration</p>
                  <h3 className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{Math.round(processedResults[selectedAlgorithmIndex].totalDurationMinutes)} <span className="text-sm font-sans font-normal text-slate-400">min</span></h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 text-xl">
                  <FaClock />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlgorithmComparison;