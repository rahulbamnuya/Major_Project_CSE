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
    <div className="location-search-container" ref={searchRef}>
      <div className="search-input-container">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setShowHistory(true)}
          // Delay blur to allow click on results
          onBlur={() => setTimeout(() => setShowHistory(false), 200)}
          placeholder="Search place (e.g. Indore Zoo)..."
          className="search-input"
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
          className="search-button"
          type="button"
        >
          {isLoading ? <span className="animate-spin inline-block">↻</span> : '🔍'}
        </button>
      </div>

      {/* Debug/Status Feedback */}
      <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-b-lg text-xs text-black font-medium border-x border-b border-slate-200">
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
        <div className="search-results" style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          zIndex: 9999,
          color: 'black',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {searchResults.map((result, index) => (
            <div
              key={index}
              className="search-result-item hover:bg-slate-50 border-b border-slate-100 p-3 cursor-pointer"
              onMouseDown={() => handleLocationSelect(result)}
            >
              <div className="result-name font-bold text-slate-800">{result.display_name.split(',')[0]}</div>
              <div className="result-address text-xs text-slate-500">{result.display_name}</div>
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