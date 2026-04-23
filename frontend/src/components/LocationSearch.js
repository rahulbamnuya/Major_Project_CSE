// client/src/components/LocationSearch.js
import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import 'leaflet-control-geocoder';
import '../styles/LocationSearch.css';

const LocationSearch = ({ onLocationSelect, map }) => {
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [noResults, setNoResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const searchRef = useRef(null);
  const geocoderRef = useRef(null);

  // Load search history
  useEffect(() => {
    const savedHistory = localStorage.getItem('locationSearchHistory');
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory));
    }
  }, []);

  const saveToHistory = (searchTerm) => {
    const newHistory = [
      searchTerm,
      ...searchHistory.filter(item => item !== searchTerm)
    ].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('locationSearchHistory', JSON.stringify(newHistory));
  };

  // Leaflet Geocoder Control (Optional)
  useEffect(() => {
    if (map && !geocoderRef.current) {
      geocoderRef.current = L.Control.geocoder({
        defaultMarkGeocode: false,
        placeholder: 'Search...',
      }).on('markgeocode', function (e) {/* No-op */ });
    }
  }, [map]);

  // Debounced Auto-Search
  useEffect(() => {
    setNoResults(false);
    if (!searchTerm.trim() || searchTerm.length < 3) {
      setSearchResults([]);
      return;
    }
    const timerId = setTimeout(() => {
      handleSearch();
    }, 500);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setError(null);
    setNoResults(false);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=5`
      );

      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setSearchResults(data);
      setNoResults(data.length === 0);
    } catch (err) {
      console.error(err);
      setError('Connection error. Retrying...');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = (result) => {
    const location = {
      name: result.display_name.split(',')[0],
      address: result.display_name,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon)
    };
    saveToHistory(searchTerm);
    onLocationSelect(location);
    setSearchResults([]);
    setSearchTerm('');
    setShowHistory(false);
    setNoResults(false);

    if (map) {
      map.setView([location.latitude, location.longitude], 15);
    }
  };

  const handleHistorySelect = (historyItem) => {
    setSearchTerm(historyItem);
    setShowHistory(false);
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('locationSearchHistory');
  };

  const handleClear = () => {
    setSearchTerm('');
    setSearchResults([]);
    setNoResults(false);
    setShowHistory(true);
  };

  return (
    <div className="relative w-full" ref={searchRef}>
      <div className="flex items-center bg-white dark:bg-slate-900">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setShowHistory(true)}
          // Delay blur to allow click on results
          onBlur={() => setTimeout(() => setShowHistory(false), 200)}
          placeholder="Search place (e.g. Indore Zoo)..."
          className="w-full bg-transparent px-4 py-3 outline-none text-slate-800 dark:text-slate-100 font-medium placeholder-slate-400 dark:placeholder-slate-500"
        />

        {searchTerm && (
          <button
            onClick={handleClear}
            className="px-3 text-slate-400 hover:text-red-500 font-bold"
            type="button"
          >
            ✕
          </button>
        )}

        <button
          onClick={handleSearch}
          disabled={isLoading || !searchTerm.trim()}
          className="px-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          type="button"
        >
          {isLoading ? <span className="animate-spin inline-block">↻</span> : '🔍'}
        </button>
      </div>

      {/* Debug/Status Feedback */}
      <div className="bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700">
        {isLoading ? 'Searching...' : searchResults.length > 0 ? `${searchResults.length} results (Click to select)` : noResults ? 'No results found' : 'Type to search'}
      </div>

      {/* Search History */}
      {showHistory && searchHistory.length > 0 && !noResults && searchResults.length === 0 && (
        <div className="search-history">
          <div className="history-header">
            <span>Recent</span>
            <button onMouseDown={clearHistory} className="clear-history-btn">Clear</button>
          </div>
          {searchHistory.map((item, index) => (
            <div key={index} className="history-item" onMouseDown={() => handleHistorySelect(item)}>
              <span className="history-icon">🕒</span>
              <span className="history-text">{item}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-[9999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-b-xl overflow-y-auto max-h-[300px]">
          {searchResults.map((result, index) => (
            <div
              key={index}
              className="hover:bg-blue-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700/50 p-3 cursor-pointer transition-colors"
              onMouseDown={() => handleLocationSelect(result)}
            >
              <div className="font-bold text-slate-800 dark:text-white mb-0.5">{result.display_name.split(',')[0]}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{result.display_name}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="search-error">{error}</div>
      )}
    </div>
  );
};

export default LocationSearch;