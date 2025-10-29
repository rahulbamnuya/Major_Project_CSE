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
  FaDollarSign,
  FaChartLine,
  FaBalanceScale,
} from "react-icons/fa";
import OptimizationService from "../services/optimization.service";
import { useToast } from "../components/ToastProvider";
import "../styles/AlgorithmComparison.css";

// Import Recharts
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

const DEFAULT_FUEL_COST_PER_KM = 10;
const DEFAULT_DRIVER_COST_PER_KM = 8;

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

  // --- Compute all cost-related metrics ---
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

      result.routes?.forEach((route) => {
        if (route.vehicle) {
          uniqueVehicles.add(route.vehicleName);
          totalDistance += route.distance || 0;
          totalStops += route.stops?.length || 0;

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
        avgCostPerKm:
          totalDistance > 0 ? (totalFuelCost + totalDriverCost) / totalDistance : 0,
        avgCostPerVehicle:
          uniqueVehicles.size > 0
            ? (totalFuelCost + totalDriverCost) / uniqueVehicles.size
            : 0,
      };
    });
  }, [optimization]);

  // --- Find best algorithm (lowest total cost) ---
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
    if (bestAlgorithmIndex !== null) {
      setSelectedAlgorithmIndex(bestAlgorithmIndex);
    } else if (processedResults.length > 0) {
      setSelectedAlgorithmIndex(0);
    }
  }, [bestAlgorithmIndex, processedResults]);

  // --- Format helpers ---
  const formatDistance = (d) => `${Number(d || 0).toFixed(2)} km`;
  const formatCurrency = (a) => `₹${Number(a || 0).toFixed(2)}`;

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="loading-container">
          <div className="spinner-large"></div>
          <p>Loading algorithm comparison...</p>
        </div>
      </div>
    );

  if (error || !optimization)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <p>{error || "Optimization not found"}</p>
        <Link to="/optimizations" className="btn btn-primary">
          Back to Optimizations
        </Link>
      </div>
    );

  if (processedResults.length === 0)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <h2>No Algorithm Comparison Available</h2>
        <Link to="/optimizations/new" className="btn btn-primary mt-4">
          Create New Optimization
        </Link>
      </div>
    );

  const selectedResult = processedResults[selectedAlgorithmIndex];
  const totalVehicles = optimization.vehicles.length;

  // --- Prepare data for chart ---
  const chartData = processedResults.map((r) => ({
    name: r.algorithm,
    "Total Cost": r.totalCost,
    "Fuel Cost": r.totalFuelCost,
    "Driver Cost": r.totalDriverCost,
    "Distance": r.totalDistance,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 pb-20">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="comparison-header">
          <Link to={`/optimizations/${id}`} className="back-link">
            <FaArrowLeft /> Back
          </Link>
          <h1>Algorithm Cost & Performance Comparison</h1>
          <p className="optimization-name">{optimization.name}</p>
        </div>

        {/* Graph Section */}
        <div className="chart-container my-8" data-aos="fade-up">
          <h2 className="text-xl font-semibold mb-4">Algorithm Comparison Graph</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="Total Cost" fill="#4f46e5" />
              <Bar dataKey="Fuel Cost" fill="#10b981" />
              <Bar dataKey="Driver Cost" fill="#f59e0b" />
              <Bar dataKey="Distance" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Existing Table and Details go here */}
        {/* ...keep your table and detailed metrics code as is... */}
      </div>
    </div>
  );
};

export default AlgorithmComparison;
