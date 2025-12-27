import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import LocationService from '../services/location.service';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import LocationSearch from '../components/LocationSearch';
import { useToast } from '../components/ToastProvider';
import { FaMapMarkerAlt, FaSearch, FaSave, FaArrowLeft, FaInfoCircle, FaSpinner, FaLayerGroup, FaTruckLoading, FaClock } from 'react-icons/fa';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Helper functions for time
const timeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  if (minutes === null || isNaN(minutes)) return '';
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const LocationForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const { notify } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    demand: '0',
    isDepot: false,
    timeWindowStart: '',
    timeWindowEnd: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      fetchLocation();
    }

    // Initialize map
    // We wrap this in a timeout to ensure the DOM element has dimensions
    const timer = setTimeout(() => {
      if (!mapInstanceRef.current && mapRef.current) {
        mapInstanceRef.current = L.map(mapRef.current).setView([22.7196, 75.8577], 13); // Default to Indore

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstanceRef.current);

        mapInstanceRef.current.on('click', handleMapClick);

        // If we have coordinates already (edit mode), set marker immediately
        if (formData.latitude && formData.longitude) {
          updateMapMarker(formData.latitude, formData.longitude, formData.name);
        }
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('click', handleMapClick);
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // We rely on a separate effect for coordinate updates

  // Effect to update marker when coordinates change (and map is ready)
  useEffect(() => {
    if (mapInstanceRef.current && formData.latitude && formData.longitude) {
      updateMapMarker(formData.latitude, formData.longitude, formData.name);
    }
  }, [formData.latitude, formData.longitude, formData.name]);

  const updateMapMarker = (lat, lng, name) => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (!isNaN(latitude) && !isNaN(longitude)) {
      if (markerRef.current) {
        markerRef.current.remove();
      }
      markerRef.current = L.marker([latitude, longitude])
        .addTo(mapInstanceRef.current)
        .bindPopup(name || 'Selected Location')
        .openPopup();

      mapInstanceRef.current.setView([latitude, longitude], 15);
    }
  };

  const fetchLocation = async () => {
    try {
      setLoading(true);
      const response = await LocationService.get(id);
      const { name, address, latitude, longitude, demand, isDepot, timeWindowStart, timeWindowEnd } = response;
      setFormData({
        name: name || '',
        address: address || '',
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        demand: (demand || 0).toString(),
        isDepot: isDepot || false,
        timeWindowStart: minutesToTime(timeWindowStart),
        timeWindowEnd: minutesToTime(timeWindowEnd),
      });
      // Trigger map update via effect
      notify('Location loaded', 'success');
    } catch (err) {
      setError('Failed to load location data');
      notify('Failed to load location data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (e) => {
    const { lat, lng } = e.latlng;
    setFormData(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6)
    }));
    if (!formData.name) reverseGeocode(lat, lng);
  };

  const reverseGeocode = async (lat, lng) => {
    setGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      if (response.ok) {
        const data = await response.json();
        const address = data.display_name;
        const name = address.split(',')[0];
        setFormData(prev => ({ ...prev, name, address }));
      }
    } catch (err) {
      console.error('Reverse geocoding failed', err);
    } finally {
      setGeocoding(false);
    }
  };

  const handleLocationSelect = (location) => {
    setFormData(prev => ({
      ...prev,
      name: location.name || prev.name,
      address: location.address || location.name,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString()
    }));
    setShowSearch(false);
  };

  const onChange = e => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const locationData = {
        name: formData.name,
        address: formData.address,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        demand: parseInt(formData.demand),
        isDepot: formData.isDepot,
        timeWindowStart: timeToMinutes(formData.timeWindowStart),
        timeWindowEnd: timeToMinutes(formData.timeWindowEnd),
      };

      if (isEditMode) {
        await LocationService.update(id, locationData);
        notify('Location updated successfully', 'success');
      } else {
        await LocationService.create(locationData);
        notify('Location created successfully', 'success');
      }
      navigate('/locations');
    } catch (err) {
      setError('Failed to save location');
      notify('Failed to save location', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 font-sans text-slate-800 dark:text-slate-100">
      <div className="container mx-auto px-4 md:px-8 py-8 max-w-5xl">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <Link to="/locations" className="text-slate-500 hover:text-blue-600 flex items-center gap-2 mb-2 transition-colors">
              <FaArrowLeft className="text-sm" /> Back to Locations
            </Link>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {isEditMode ? 'Edit Location' : 'Add New Location'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Define coordinates and constraints for your stops.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800 mb-6 flex items-center gap-3">
            <FaInfoCircle /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Form Section */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <form onSubmit={onSubmit} className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-700 space-y-6">

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Location Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={onChange}
                  required
                  placeholder="e.g. Warehouse A"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Full Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={onChange}
                  rows="3"
                  placeholder="Address details..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Latitude</label>
                  <input type="text" name="latitude" value={formData.latitude} onChange={onChange} required readOnly className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Longitude</label>
                  <input type="text" name="longitude" value={formData.longitude} onChange={onChange} required readOnly className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-500 cursor-not-allowed" />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-white font-bold">
                  <FaTruckLoading className="text-indigo-500" /> Logistics Details
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Demand (Units)</label>
                    <input type="number" name="demand" value={formData.demand} onChange={onChange} min="0" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Window Start</label>
                      <input type="time" name="timeWindowStart" value={formData.timeWindowStart} onChange={onChange} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Window End</label>
                      <input type="time" name="timeWindowEnd" value={formData.timeWindowEnd} onChange={onChange} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700">
                    <input
                      type="checkbox"
                      id="isDepot"
                      name="isDepot"
                      checked={formData.isDepot}
                      onChange={onChange}
                      className="w-5 h-5 accent-blue-600 rounded"
                    />
                    <label htmlFor="isDepot" className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                      Set as Depot (Start/End Point)
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => navigate('/locations')} className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 flex items-center justify-center gap-2">
                  {loading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div> : <><FaSave /> Save Location</>}
                </button>
              </div>

            </form>
          </div>

          {/* Map Section */}
          <div className="lg:col-span-2 order-1 lg:order-2 space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-2 shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden relative group">

              {/* Search Overlay */}
              <div className="absolute top-6 left-6 right-6 z-[400]">
                {!showSearch ? (
                  <button onClick={() => setShowSearch(true)} className="w-full bg-white dark:bg-slate-900/90 backdrop-blur text-left px-4 py-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:ring-2 hover:ring-blue-400 transition-all flex items-center gap-3">
                    <FaSearch className="text-slate-400" />
                    <span>Search for a place...</span>
                  </button>
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 animation-fade-in-down">
                    <div className="p-2 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold uppercase text-slate-400 pl-2">Location Search</span>
                      <button onClick={() => setShowSearch(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500">✕</button>
                    </div>
                    <LocationSearch onLocationSelect={handleLocationSelect} />
                  </div>
                )}
              </div>

              {/* The Map itself with explicit height */}
              <div ref={mapRef} className="h-[500px] w-full rounded-2xl z-0 bg-slate-100 dark:bg-slate-900"></div>

              {/* Footer Info */}
              <div className="absolute bottom-6 left-6 right-6 z-[400] pointer-events-none">
                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg text-xs font-medium text-slate-600 dark:text-slate-300 inline-flex items-center gap-2 pointer-events-auto">
                  <FaMapMarkerAlt className="text-red-500" /> Click on map to drop pin
                  {geocoding && <span className="flex items-center gap-1 text-blue-600 ml-2"><FaSpinner className="animate-spin" /> Fetching address...</span>}
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex items-start gap-3">
              <FaInfoCircle className="mt-1 flex-shrink-0" />
              <p className="text-sm">
                <strong>Tip:</strong> You can search for a location using the search bar, or manually click anywhere on the map to set coordinates. If available, we'll automatically fill in the address for you.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LocationForm;