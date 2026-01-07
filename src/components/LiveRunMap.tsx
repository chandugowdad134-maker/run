import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Circle, useMap } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

interface LiveRunMapProps {
  gpsPoints: GPSPoint[];
  currentPosition: GPSPoint | null;
  isTracking: boolean;
}

// Component to auto-follow current position
function MapFollower({ position }: { position: GPSPoint | null }) {
  const map = useMap();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (position) {
      if (!hasInitialized.current) {
        // Initial center
        map.setView([position.latitude, position.longitude], 16);
        hasInitialized.current = true;
      } else {
        // Smoothly pan to new position
        map.panTo([position.latitude, position.longitude], {
          animate: true,
          duration: 0.5,
        });
      }
    }
  }, [position, map]);

  return null;
}

const LiveRunMap = ({ gpsPoints, currentPosition, isTracking }: LiveRunMapProps) => {
  const defaultCenter: [number, number] = [37.7749, -122.4194];
  const center = currentPosition 
    ? [currentPosition.latitude, currentPosition.longitude] as [number, number]
    : defaultCenter;

  // Convert GPS points to Leaflet format
  const routePositions: LatLngExpression[] = gpsPoints.map((p) => [
    p.latitude,
    p.longitude,
  ]);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden">
      <MapContainer
        center={center}
        zoom={16}
        className="w-full h-full"
        zoomControl={false}
      >
        {/* OpenStreetMap Tiles */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />

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
        <MapFollower position={currentPosition} />
      </MapContainer>
    </div>
  );
};

export default LiveRunMap;
