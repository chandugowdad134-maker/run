import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Polygon, useMap } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RunMapProps {
  geojson: any; // GeoJSON LineString for the run path
  territories: Array<{
    run_id: number;
    owner_id: number;
    distance_km: number;
    created_at: string;
    geometry?: any;
  }>;
  className?: string;
}

// Component to fit map bounds to show all content
function FitBounds({ geojson, territories }: { geojson: any; territories: RunMapProps['territories'] }) {
  const map = useMap();

  useEffect(() => {
    const bounds: LatLngExpression[] = [];

    // Add run path points to bounds
    if (geojson?.coordinates) {
      geojson.coordinates.forEach((coord: [number, number]) => {
        bounds.push([coord[1], coord[0]]); // GeoJSON is [lng, lat], Leaflet wants [lat, lng]
      });
    }

    // Add territory bounds if available
    territories.forEach(territory => {
      if (territory.geometry?.coordinates) {
        territory.geometry.coordinates[0]?.forEach((coord: [number, number]) => {
          bounds.push([coord[1], coord[0]]);
        });
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, geojson, territories]);

  return null;
}

const RunMap = ({ geojson, territories, className = "h-64 rounded-lg" }: RunMapProps) => {
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([51.505, -0.09]); // Default center
  const [mapZoom, setMapZoom] = useState(13);

  // Extract run path coordinates
  const runPath: LatLngExpression[] = [];
  if (geojson?.coordinates) {
    geojson.coordinates.forEach((coord: [number, number]) => {
      runPath.push([coord[1], coord[0]]); // Convert [lng, lat] to [lat, lng]
    });
  }

  // Set initial center to first point of run
  useEffect(() => {
    if (runPath.length > 0) {
      setMapCenter(runPath[0]);
    }
  }, [runPath]);

  return (
    <div className={className}>
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Run path */}
        {runPath.length > 1 && (
          <Polyline
            positions={runPath}
            pathOptions={{
              color: '#10b981', // emerald-500
              weight: 4,
              opacity: 0.8,
            }}
          />
        )}

        {/* Conquered territories */}
        {territories.map((territory) => {
          if (!territory.geometry?.coordinates) return null;

          return (
            <Polygon
              key={territory.run_id}
              positions={territory.geometry.coordinates[0].map((coord: [number, number]) => [
                coord[1], coord[0] // Convert [lng, lat] to [lat, lng]
              ])}
              pathOptions={{
                color: '#f59e0b', // amber-500
                weight: 2,
                opacity: 0.8,
                fillColor: '#f59e0b',
                fillOpacity: 0.3,
              }}
            />
          );
        })}

        {/* Fit bounds to show all content */}
        <FitBounds geojson={geojson} territories={territories} />
      </MapContainer>
    </div>
  );
};

export default RunMap;
