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

// Recharts imports
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

// New Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="custom-tooltip">
        <p className="label">{`${label}`}</p>
        <p className="intro">
          <span style={{ color: '#4f46e5' }}>Total Cost:</span> {`₹${Number(data['Total Cost'] || 0).toFixed(2)}`}
        </p>
        <p className="intro">
          <span style={{ color: '#10b981' }}>Fuel Cost:</span> {`₹${Number(data['Fuel Cost'] || 0).toFixed(2)}`}
        </p>
        <p className="intro">
          <span style={{ color: '#f59e0b' }}>Driver Cost:</span> {`₹${Number(data['Driver Cost'] || 0).toFixed(2)}`}
        </p>
        <p className="intro">
           <span style={{ color: '#ef4444' }}>Distance:</span> {`${Number(data['Distance'] || 0).toFixed(2)} km`}
        </p>
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

  // Process results
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
      };
    });
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
    if (bestAlgorithmIndex !== null) {
      setSelectedAlgorithmIndex(bestAlgorithmIndex);
    } else if (processedResults.length > 0) {
      setSelectedAlgorithmIndex(0);
    }
  }, [bestAlgorithmIndex, processedResults]);

  const formatDistance = (d) => `${Number(d || 0).toFixed(2)} km`;
  const formatCurrency = (a) => `₹${Number(a || 0).toFixed(2)}`;
  const totalVehicles = optimization?.vehicles.length || 0;
  const totalAlgorithms = processedResults.length;
  const selectedResult = processedResults[selectedAlgorithmIndex];

  // Chart data
  const chartData = processedResults.map((r) => ({
    name: r.algorithm,
    "Total Cost": r.totalCost,
    "Fuel Cost": r.totalFuelCost,
    "Driver Cost": r.totalDriverCost,
    "Distance": r.totalDistance,
  }));

  // Loading or error states
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 pb-20">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="comparison-header mb-8">
          <Link to={`/optimizations/${id}`} className="back-link">
            <FaArrowLeft /> Back
          </Link>
          <h1>Algorithm Cost & Performance Comparison</h1>
          <p className="optimization-name">{optimization.name}</p>
        </div>

        {/* Graph */}
        <div className="chart-container mb-8" data-aos="fade-up">
          <h2 className="text-xl font-semibold mb-4">Algorithm Comparison Graph</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="Total Cost" fill="#4f46e5" />
              <Bar dataKey="Fuel Cost" fill="#10b981" />
              <Bar dataKey="Driver Cost" fill="#f59e0b" />
              <Bar dataKey="Distance" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary */}
        <div className="summary-dashboard mb-8" data-aos="fade-up">
          <div className="summary-card">
            <FaChartLine className="icon" />
            <div>
              <h4>Total Algorithms</h4>
              <p>{totalAlgorithms}</p>
            </div>
          </div>
          <div className="summary-card">
            <FaTruck className="icon" />
            <div>
              <h4>Vehicles Available</h4>
              <p>{totalVehicles}</p>
            </div>
          </div>
          <div className="summary-card">
            <FaBalanceScale className="icon" />
            <div>
              <h4>Most Efficient</h4>
              <p>{bestAlgorithm?.algorithm || "N/A"}</p>
            </div>
          </div>
        </div>

        {/* Best Algorithm Banner */}
        {bestAlgorithm && (
          <div className="best-algorithm-banner mb-8" data-aos="fade-up">
            <div className="trophy-icon">
              <FaTrophy />
            </div>
            <div className="banner-content">
              <h3>Most Cost-Effective Algorithm</h3>
              <p className="algorithm-name">{bestAlgorithm.algorithm}</p>
              <div className="banner-metrics">
                <span>Total Cost: {formatCurrency(bestAlgorithm.totalCost)}</span>
                <span>
                  Vehicles Used: {bestAlgorithm.vehiclesUsedCount} / {totalVehicles}
                </span>
                <span>Stops: {bestAlgorithm.totalStops}</span>
                <span>Distance: {formatDistance(bestAlgorithm.totalDistance)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Table */}
        <div className="comparison-table-section mb-8" data-aos="fade-up">
          <h2>Algorithm Comparison Table</h2>
          <div className="comparison-table">
            <div className="table-header">
              <span>Algorithm</span>
              <span>Total Distance</span>
              <span>Total Cost</span>
              <span>Fuel</span>
              <span>Driver</span>
              <span>Stops</span>
              <span>Vehicles Used</span>
              <span>Cost/km</span>
              <span>Time</span>
            </div>

            {processedResults.map((result, index) => (
              <div
                key={index}
                className={`table-row ${
                  index === selectedAlgorithmIndex ? "selected" : ""
                } ${
                  bestAlgorithm &&
                  result.algorithmKey === bestAlgorithm.algorithmKey
                    ? "best"
                    : ""
                }`}
                onClick={() => setSelectedAlgorithmIndex(index)}
              >
                <span className="algorithm-name">
                  {result.algorithm}
                  {bestAlgorithm &&
                    result.algorithmKey === bestAlgorithm.algorithmKey && (
                      <FaTrophy className="best-badge" />
                    )}
                </span>
                <span>{formatDistance(result.totalDistance)}</span>
                <span className="font-bold">{formatCurrency(result.totalCost)}</span>
                <span>{formatCurrency(result.totalFuelCost)}</span>
                <span>{formatCurrency(result.totalDriverCost)}</span>
                <span>{result.totalStops}</span>
                <span>
                  {result.vehiclesUsedCount} / {totalVehicles}
                </span>
                <span>{formatCurrency(result.avgCostPerKm)}</span>
                <span>{result.executionTime}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Algorithm Details */}
        {selectedResult && (
          <div className="selected-algorithm-details" data-aos="fade-up">
            <h2>Detailed Metrics: {selectedResult.algorithm}</h2>
            <div className="details-grid">
              <div className="routes-summary">
                <h3>Route Overview</h3>
                {selectedResult.routes?.map((route, index) => (
                  <div key={index} className="route-item">
                    <div className="route-header">
                      <span className="vehicle-name">
                        {route.vehicleName || `Vehicle ${index + 1}`}
                      </span>
                      <span className="route-stats">
                        {route.stops?.length || 0} stops •{" "}
                        {formatDistance(route.distance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="key-metrics">
                <h3>Key Performance Metrics</h3>
                <div className="metrics-cards">
                  <div className="metric-card">
                    <FaDollarSign />
                    <div className="metric-content">
                      <span className="metric-value">
                        {formatCurrency(selectedResult.totalCost)}
                      </span>
                      <span className="metric-label">Total Cost</span>
                    </div>
                  </div>
                  <div className="metric-card">
                    <FaGasPump />
                    <div className="metric-content">
                      <span className="metric-value">
                        {formatCurrency(selectedResult.totalFuelCost)}
                      </span>
                      <span className="metric-label">Fuel Cost</span>
                    </div>
                  </div>
                  <div className="metric-card">
                    <FaUserCog />
                    <div className="metric-content">
                      <span className="metric-value">
                        {formatCurrency(selectedResult.totalDriverCost)}
                      </span>
                      <span className="metric-label">Driver Cost</span>
                    </div>
                  </div>
                  <div className="metric-card">
                    <FaRoute />
                    <div className="metric-content">
                      <span className="metric-value">
                        {formatDistance(selectedResult.totalDistance)}
                      </span>
                      <span className="metric-label">Distance</span>
                    </div>
                  </div>
                  <div className="metric-card">
                    <FaTruck />
                    <div className="metric-content">
                      <span className="metric-value">
                        {selectedResult.vehiclesUsedCount} / {totalVehicles}
                      </span>
                      <span className="metric-label">Vehicles Used</span>
                    </div>
                  </div>
                  <div className="metric-card">
                    <FaCalculator />
                    <div className="metric-content">
                      <span className="metric-value">
                        {formatCurrency(selectedResult.avgCostPerKm)}
                      </span>
                      <span className="metric-label">Cost per km</span>
                    </div>
                  </div>
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