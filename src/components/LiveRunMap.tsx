import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Circle, useMap, GeoJSON } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/lib/api';

interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  heading?: number;
}

interface Territory {
  tile_id: string;
  owner_id: number;
  owner_name: string;
  geometry: any;
  last_claimed: string;
  claim_count: number;
}

interface LiveRunMapProps {
  gpsPoints: GPSPoint[];
  currentPosition: GPSPoint | null;
  isTracking: boolean;
  heading?: number | null;
  followMode?: 'follow' | 'explore';
  smartZoom?: number;
  onFollowModeChange?: (mode: 'follow' | 'explore') => void;
  onTerritoryClick?: (territory: Territory) => void;
  showTerritories?: boolean;
}

// Component to auto-follow current position with imperative control
function MapFollower({ 
  position, 
  followMode,
  smartZoom,
  onFollowModeChange
}: { 
  position: GPSPoint | null;
  followMode: 'follow' | 'explore';
  smartZoom: number;
  onFollowModeChange?: (mode: 'follow' | 'explore') => void;
}) {
  const map = useMap();
  const hasInitialized = useRef(false);
  const isDragging = useRef(false);
  const lastZoom = useRef(smartZoom);

  // Detect user drag - disable follow mode
  useEffect(() => {
    const handleDragStart = () => {
      if (followMode === 'follow') {
        isDragging.current = true;
        onFollowModeChange?.('explore');
      }
    };

    const handleZoomStart = () => {
      // Manual zoom disables auto-zoom temporarily
      if (followMode === 'follow' && Math.abs(map.getZoom() - lastZoom.current) > 0.5) {
        onFollowModeChange?.('explore');
      }
    };

    map.on('dragstart', handleDragStart);
    map.on('zoomstart', handleZoomStart);

    return () => {
      map.off('dragstart', handleDragStart);
      map.off('zoomstart', handleZoomStart);
    };
  }, [map, followMode, onFollowModeChange]);

  // Imperative camera control
  useEffect(() => {
    if (position && followMode === 'follow' && !isDragging.current) {
      const zoom = smartZoom || 16;
      
      if (!hasInitialized.current) {
        // Initial center - instant
        map.setView([position.latitude, position.longitude], zoom, { animate: false });
        hasInitialized.current = true;
      } else {
        // Smooth follow - pan to position
        map.flyTo([position.latitude, position.longitude], zoom, {
          animate: true,
          duration: 0.3,
          easeLinearity: 0.5
        });
      }
      
      lastZoom.current = zoom;
    }
    
    isDragging.current = false;
  }, [position, followMode, smartZoom, map]);

  return null;
}

const LiveRunMap = ({ 
  gpsPoints, 
  currentPosition, 
  isTracking,
  heading = null,
  followMode = 'follow',
  smartZoom = 16,
  onFollowModeChange,
  onTerritoryClick,
  showTerritories = true
}: LiveRunMapProps) => {
  const defaultCenter: [number, number] = [37.7749, -122.4194];
  const center = currentPosition 
    ? [currentPosition.latitude, currentPosition.longitude] as [number, number]
    : defaultCenter;
  
  const [nearbyTerritories, setNearbyTerritories] = useState<Territory[]>([]);

  // Fetch nearby territories when position changes
  useEffect(() => {
    if (currentPosition && showTerritories) {
      fetchNearbyTerritories();
    }
  }, [currentPosition?.latitude, currentPosition?.longitude, showTerritories]);

  const fetchNearbyTerritories = async () => {
    if (!currentPosition) return;
    
    try {
      const response = await api.get(`/territories?limit=50`);
      
      if (response.territories) {
        setNearbyTerritories(response.territories);
      }
    } catch (error) {
      console.error('Failed to fetch territories:', error);
    }
  };

  const handleTerritoryClick = (territory: Territory) => {
    if (onTerritoryClick) {
      onTerritoryClick(territory);
    }
  };

  // Convert GPS points to Leaflet format
  const routePositions: LatLngExpression[] = gpsPoints.map((p) => [
    p.latitude,
    p.longitude,
  ]);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden relative bg-gray-900">
      <div className="w-full h-full">
        <MapContainer
          center={center}
          zoom={smartZoom}
          className="w-full h-full"
          zoomControl={false}
          attributionControl={false}
        >
          {/* OpenStreetMap Tiles */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />

          {/* Nearby Territories */}
          {showTerritories && nearbyTerritories.map((territory) => (
            <GeoJSON
              key={territory.tile_id}
              data={territory.geometry}
              style={{
                fillColor: territory.owner_id ? '#3b82f6' : '#6b7280',
                fillOpacity: 0.2,
                color: territory.owner_id ? '#3b82f6' : '#6b7280',
                weight: 2,
                opacity: 0.6,
              }}
              eventHandlers={{
                click: () => handleTerritoryClick(territory),
              }}
            />
          ))}

          {/* Running Route */}
          {routePositions.length > 1 && (
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: '#22d3ee',
                weight: 4,
                opacity: 0.8,
              }}
            />
          )}

          {/* Current Position Marker */}
          {currentPosition && (
            <>
              {/* Accuracy circle */}
              {currentPosition.accuracy && (
                <Circle
                  center={[currentPosition.latitude, currentPosition.longitude]}
                  radius={currentPosition.accuracy}
                  pathOptions={{
                    fillColor: '#22d3ee',
                    fillOpacity: 0.1,
                    color: '#22d3ee',
                    weight: 1,
                  }}
                />
              )}
              {/* Position dot */}
              <Circle
                center={[currentPosition.latitude, currentPosition.longitude]}
                radius={5}
                pathOptions={{
                  fillColor: isTracking ? '#22d3ee' : '#f97316',
                  fillOpacity: 1,
                  color: '#ffffff',
                  weight: 2,
                }}
              />
            </>
          )}

          {/* Auto-follow current position */}
          <MapFollower 
            position={currentPosition}
            followMode={followMode}
            smartZoom={smartZoom}
            onFollowModeChange={onFollowModeChange}
          />
        </MapContainer>
      </div>

      {/* Heading compass indicator overlay - counter-rotate to stay upright */}
      {heading !== null && followMode === 'follow' && (
        <div 
          className="absolute top-4 right-4 z-[1000] bg-white/90 dark:bg-black/90 rounded-full p-3 shadow-lg"
          style={{ transform: `rotate(${heading}deg)` }}
        >
          <div className="w-8 h-8 flex items-center justify-center text-2xl text-red-600 font-bold">
            ↑
          </div>
        </div>
      )}
      
      {/* Follow Mode Status Badge */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className={`px-3 py-2 rounded-full shadow-lg text-sm font-semibold flex items-center gap-2 ${
          followMode === 'follow' 
            ? 'bg-green-500 text-white' 
            : 'bg-white/90 dark:bg-black/90 text-gray-700 dark:text-gray-300'
        }`}>
          {followMode === 'follow' ? (
            <>
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Following
            </>
          ) : (
            <>Manual</>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveRunMap;
