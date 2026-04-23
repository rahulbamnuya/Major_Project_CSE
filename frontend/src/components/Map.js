import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import '../styles/Map.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const Map = ({
  locations = [],
  routes = [],
  vehicles = [],
  onLocationSelect,
  onMapClick,
  center = [22.7196, 75.8577], // Indore, India coordinates
  zoom = 13,
  height = "500px",
  useRoadNetwork = false,
  routedPolylines = {},
  onRouteSelect,
  optimizationId,
  onRoutedPolylinesUpdate,
  isLoadingRoutes = false,
  selectedRouteIndex = null, // External control
}) => {
  const routeColors = [
    '#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6',
    '#0ea5e9', '#ec4899', '#14b8a6', '#f97316', '#64748b'
  ];

  // State for selected route (can be controlled externally or internally)
  const [internalSelectedRoute, setInternalSelectedRoute] = useState(null);

  // Create professional, monochromatic custom icons
  const createCustomIcon = (type, number = null, color = '#1e293b', isSelected = false) => {
    let className = 'custom-marker';
    let html = '';
    let scale = isSelected ? 1.1 : 1;
    let iconSize = [32 * scale, 32 * scale];
    let iconAnchor = [(16 * scale), (32 * scale)];

    // We no longer use solid fill for selection to avoid 'dark/same color' confusion.
    // Instead, we use a thicker, high-contrast border and a premium shadow.
    const baseStyle = `
      width: 100%;
      height: 100%;
      background: white;
      color: ${color};
      display: flex;
      align-items: center;
      justify-content: center;
      border: ${isSelected ? '4px' : '1.5px'} solid ${color};
      box-shadow: ${isSelected ? '0 0 15px rgba(0,0,0,0.3)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)'};
      transform: translateY(-50%);
      z-index: ${isSelected ? 1000 : 1};
      transition: all 0.3s ease;
    `;

    switch (type) {
      case 'depot':
        className += ' depot';
        iconSize = [44 * scale, 44 * scale];
        iconAnchor = [22 * scale, 44 * scale];
        html = `<div style="${baseStyle} border-radius: 12px; font-size: ${24 * scale}px; border-width: 4px;">🏭</div>`;
        break;
      case 'location':
        className += ' location';
        iconSize = [32 * scale, 32 * scale];
        iconAnchor = [16 * scale, 32 * scale];
        html = `<div style="${baseStyle} border-radius: 50%; font-size: ${16 * scale}px;">📍</div>`;
        break;
      case 'vehicle':
        className += ' vehicle';
        iconSize = [36 * scale, 36 * scale];
        iconAnchor = [18 * scale, 36 * scale];
        html = `<div style="${baseStyle} border-radius: 10px; font-size: ${20 * scale}px; border-style: dashed;">🚛</div>`;
        break;
      case 'stop':
        className += ' numbered-stop';
        iconSize = [24 * scale, 24 * scale];
        iconAnchor = [12 * scale, 24 * scale];
        html = `
          <div style="${baseStyle} border-radius: 50%; font-size: ${11 * scale}px; font-weight: 900;">
            ${number || '•'}
          </div>
        `;
        break;
      default:
        html = `<div style="${baseStyle} border-radius: 50%; font-size: 16px;">📍</div>`;
    }

    return L.divIcon({
      className,
      html,
      iconSize,
      iconAnchor,
      popupAnchor: [0, -iconAnchor[1]]
    });
  };

  const activeSelectedRoute = selectedRouteIndex !== null && selectedRouteIndex !== undefined && selectedRouteIndex !== -1
    ? selectedRouteIndex
    : internalSelectedRoute;

  const [hoveredRoute, setHoveredRoute] = useState(null);
  const [visibleRoutes, setVisibleRoutes] = useState(new Set(routes.map((_, index) => index)));

  // Get vehicle by ID
  const getVehicleById = (vehicleId) => {
    return vehicles.find(v => v._id === vehicleId) || { name: 'Unknown Vehicle' };
  };

  // Handle route click with real road routing
  const handleRouteClick = async (route, routeIndex) => {
    setInternalSelectedRoute(activeSelectedRoute === routeIndex ? null : routeIndex);
    if (onRouteSelect) {
      onRouteSelect(route, routeIndex);
    }

    // If useRoadNetwork is enabled, fetch real road route
    if (useRoadNetwork && route.stops && route.stops.length > 0) {
      try {
        console.log('Fetching road route for route', routeIndex);
        // Fetch real road route from backend
        const response = await fetch(`/api/optimizations/${optimizationId}/routes/${routeIndex}/polyline`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const roadRoute = await response.json();
          console.log('Road route fetched:', roadRoute);

          // Update the route with real road geometry
          if (onRoutedPolylinesUpdate && roadRoute.geometry && roadRoute.geometry.coordinates) {
            const coordinates = roadRoute.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            onRoutedPolylinesUpdate(routeIndex, coordinates);

            // Show notification about route type
            if (roadRoute.fallback) {
              console.log('Using fallback straight-line route');
            } else {
              console.log('Using real road network route');
            }
          }
        } else {
          console.error('Failed to fetch road route:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Failed to fetch road route:', error);
        // Fallback will be handled by backend
      }
    }
  };

  // Handle route hover
  const handleRouteHover = (routeIndex) => {
    setHoveredRoute(routeIndex);
  };

  const handleRouteLeave = () => {
    setHoveredRoute(null);
  };

  // Handle route visibility toggle
  const toggleRouteVisibility = (routeIndex) => {
    const newVisibleRoutes = new Set(visibleRoutes);
    if (newVisibleRoutes.has(routeIndex)) {
      newVisibleRoutes.delete(routeIndex);
    } else {
      newVisibleRoutes.add(routeIndex);
    }
    setVisibleRoutes(newVisibleRoutes);
  };



  // Toggle all routes visibility
  const toggleAllRoutesVisibility = () => {
    if (visibleRoutes.size === routes.length) {
      setVisibleRoutes(new Set());
    } else {
      setVisibleRoutes(new Set(routes.map((_, index) => index)));
    }
  };



  // Convert route to polyline coordinates with better error handling
  const getRouteCoordinates = (route, routeIndex) => {
    if (!route.stops || route.stops.length === 0) return [];

    if (useRoadNetwork && routedPolylines[routeIndex]) {
      // Use actual road network polyline if available
      const polyline = routedPolylines[routeIndex];
      if (Array.isArray(polyline) && polyline.length > 0) {
        return polyline;
      }
    }

    // Use straight lines between stops with validation
    const coordinates = [];
    for (const stop of route.stops) {
      const location = locations.find(loc => {
        // Handle both string and object IDs
        const stopId = typeof stop.locationId === 'object' ? stop.locationId.toString() : stop.locationId;
        const locId = typeof loc._id === 'object' ? loc._id.toString() : loc._id;
        return stopId === locId;
      });

      if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
        coordinates.push([location.latitude, location.longitude]);
      }
    }

    return coordinates;
  };

  // Check if route has real road network data
  const hasRealRoadData = (routeIndex) => {
    return useRoadNetwork && routedPolylines[routeIndex] && Array.isArray(routedPolylines[routeIndex]) && routedPolylines[routeIndex].length > 0;
  };

  const memoizedMarkers = useMemo(() => {
    return locations.map((location) => (
      <Marker
        key={`loc-marker-${location._id}`}
        position={[location.latitude, location.longitude]}
        icon={createCustomIcon(location.isDepot ? 'depot' : 'location')}
        eventHandlers={{
          click: () => onLocationSelect && onLocationSelect(location),
        }}
      >
        <Popup>
          <div className="location-popup">
            <h3>{location.name}</h3>
            <p><strong>Type:</strong> {location.isDepot ? 'Depot' : 'Delivery Location'}</p>
            <p><strong>Address:</strong> {location.address}</p>
            {location.demand && <p><strong>Demand:</strong> {location.demand}</p>}
            <p><strong>Coordinates:</strong> {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
          </div>
        </Popup>
      </Marker>
    ));
  }, [locations, onLocationSelect]);

  const memoizedRoutes = useMemo(() => {
    return routes.map((route, routeIndex) => {
      const coordinates = getRouteCoordinates(route, routeIndex);
      const color = routeColors[routeIndex % routeColors.length];
      const vehicle = getVehicleById(route.vehicle);
      const isSelected = activeSelectedRoute === routeIndex;
      const isVisible = visibleRoutes.has(routeIndex);

      if (coordinates.length < 2 || !isVisible) return null;

      return (
        <React.Fragment key={`route-group-${routeIndex}`}>
          <Polyline
            positions={coordinates}
            color={color}
            weight={isSelected ? 10 : hoveredRoute === routeIndex ? 8 : hasRealRoadData(routeIndex) ? 5 : 4}
            opacity={isSelected ? 1 : hoveredRoute === routeIndex ? 0.95 : hasRealRoadData(routeIndex) ? 0.95 : 0.8}
            dashArray={hasRealRoadData(routeIndex) ? null : '5, 5'}
            eventHandlers={{
              click: () => handleRouteClick(route, routeIndex),
              mouseover: () => handleRouteHover(routeIndex),
              mouseout: () => handleRouteLeave(),
            }}
          />
          {coordinates.length > 2 && (
            <Polyline
              positions={coordinates}
              color={color}
              weight={2}
              opacity={0.6}
              dashArray="1, 10"
            />
          )}
          {route.stops && route.stops.map((stop, stopIndex) => {
            const location = locations.find(loc => (loc._id === stop?.locationId || loc._id?.toString() === stop?.locationId?.toString()));
            if (!location) return null;
            return (
              <Marker
                key={`stop-${routeIndex}-${stopIndex}`}
                position={[location.latitude, location.longitude]}
                icon={createCustomIcon('stop', stopIndex + 1, color, isSelected)}
              >
                <Popup>
                  <div className="stop-popup">
                    <h3>Stop {stopIndex + 1}</h3>
                    <p><strong>{location.name}</strong></p>
                    <p><strong>Route:</strong> {vehicle.name}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </React.Fragment>
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, activeSelectedRoute, visibleRoutes, hoveredRoute, locations, routedPolylines, useRoadNetwork]);


  return (
    <div className="map-wrapper" style={{ height, position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {memoizedMarkers}
        {memoizedRoutes}
      </MapContainer>

      {/* Route Summary Overlay */}
      {routes && routes.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            background: '#ffffff',
            border: '1px solid #94a3b8',
            borderRadius: '16px',
            padding: '16px',
            maxWidth: '260px',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)',
            zIndex: 1000
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h4 style={{ margin: '0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
              Route Summary
            </h4>
            <button
              onClick={toggleAllRoutesVisibility}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                fontSize: '12px',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {visibleRoutes.size === routes.length ? 'Hide All' : 'Show All'}
            </button>
          </div>
          <div style={{ maxHeight: '250px', overflow: 'auto' }}>
            {routes.map((route, index) => {
              const vehicle = getVehicleById(route.vehicle);
              const color = routeColors[index % routeColors.length];
              const isVisible = visibleRoutes.has(index);

              return (
                <div
                  key={`route-summary-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                    padding: '6px',
                    borderRadius: '4px',
                    background: isVisible ? '#f9fafb' : '#f3f4f6',
                    opacity: isVisible ? 1 : 0.6
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => toggleRouteVisibility(index)}
                    style={{
                      width: '14px',
                      height: '14px',
                      margin: '0',
                      flexShrink: 0
                    }}
                  />
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '2px',
                      background: color,
                      flexShrink: 0
                    }}
                  />
                  <div style={{ fontSize: '12px', flex: 1 }}>
                    <div style={{ fontWeight: '700', color: '#1e293b' }}>{vehicle.name}</div>
                    <div style={{ color: '#374151', fontWeight: '600' }}>
                      {route.stops?.length || 0} stops • {Number(route.distance || 0).toFixed(1)} km
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {isLoadingRoutes && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              background: '#fef3c7',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#92400e',
              textAlign: 'center'
            }}>
              🔄 Calculating real routes...
            </div>
          )}
        </div>
      )}



      {/* Location Summary */}
      {locations && locations.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '12px',
            padding: '16px',
            maxWidth: '280px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 1000
          }}
        >
          <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
            📍 Locations ({locations.length})
          </h4>
          <div style={{ fontSize: '14px', color: '#4b5563' }}>
            <div style={{ marginBottom: '4px' }}>
              🏭 {locations.filter(loc => loc.isDepot).length} depots
            </div>
            <div>
              📦 {locations.filter(loc => !loc.isDepot).length} delivery stops
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Map;
