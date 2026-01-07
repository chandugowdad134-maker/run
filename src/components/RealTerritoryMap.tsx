import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, useMap, Circle, Marker } from 'react-leaflet';
import { LatLngExpression, Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiFetch } from '@/lib/api';
import { Crosshair } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type Territory = {
  tile_id: string;
  owner_id: number;
  strength: number;
  geojson: {
    type: string;
    coordinates: number[][][];
  };
};

type Run = {
  id: number;
  user_id: number;
  geojson: {
    type: string;
    coordinates: number[][];
  };
  distance_km: number;
};

// Custom user location icon
const createUserLocationIcon = () => {
  return new DivIcon({
    html: `
      <div style="position: relative; width: 24px; height: 24px;">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 16px;
          height: 16px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background: rgba(59, 130, 246, 0.2);
          border: 2px solid rgba(59, 130, 246, 0.4);
          border-radius: 50%;
          animation: pulse 2s infinite;
        "></div>
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.6; }
        }
      </style>
    `,
    className: 'custom-user-location-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Component to handle map bounds - disabled to preserve user location
function MapBoundsHandler({ territories }: { territories: Territory[] }) {
  // Disabled auto-fit to preserve user's current location view
  return null;
}

// Location button component
function LocationButton({ onLocate }: { onLocate: () => void }) {
  return (
    <button
      onClick={onLocate}
      className="absolute top-4 right-4 z-[1000] bg-white hover:bg-gray-50 text-gray-700 rounded-lg shadow-lg p-2.5 transition-all border border-gray-200"
      title="Show my location"
    >
      <Crosshair className="w-5 h-5" />
    </button>
  );
}

const RealTerritoryMap = ({ center, zoom = 13, showRuns = false }: { 
  center?: [number, number]; 
  zoom?: number;
  showRuns?: boolean;
}) => {
  const { user } = useAuth();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [initialCenter, setInitialCenter] = useState<[number, number]>(center || [37.7749, -122.4194]);
  const [friendIds, setFriendIds] = useState<Set<number>>(new Set());
  const [teamMemberIds, setTeamMemberIds] = useState<Set<number>>(new Set());

  // Get user location on mount
  useEffect(() => {
    if (!center && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const location: [number, number] = [latitude, longitude];
          setUserLocation(location);
          setInitialCenter(location);
        },
        (error) => {
          console.log('Location access denied or unavailable, using default location');
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else if (center) {
      setInitialCenter(center);
    }
  }, [center]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        console.log('Fetching territories, runs, friends, and teams...');
        const [terrData, runData, friendsData, teamsData] = await Promise.all([
          apiFetch('/territories?limit=500'),
          showRuns ? apiFetch('/runs?limit=100') : Promise.resolve({ runs: [] }),
          apiFetch('/friends').catch(() => ({ friends: [] })),
          apiFetch('/teams/my-teams').catch(() => ({ teams: [] }))
        ]);
        
        console.log('Territories:', terrData.territories?.length || 0);
        console.log('Runs:', runData.runs?.length || 0);
        console.log('Friends:', friendsData.friends?.length || 0);
        console.log('Teams:', teamsData.teams?.length || 0);
        
        if (!mounted) return;
        setTerritories(terrData.territories || []);
        setRuns(runData.runs || []);
        
        // Extract friend IDs (only accepted friends)
        const acceptedFriendIds = new Set(
          (friendsData.friends || [])
            .filter((f: any) => f.status === 'accepted')
            .map((f: any) => f.id)
        );
        setFriendIds(acceptedFriendIds);
        
        // Extract team member IDs from all user's teams
        const teamMemberPromises = (teamsData.teams || []).map((team: any) =>
          apiFetch(`/teams/${team.id}/members`).catch(() => ({ members: [] }))
        );
        const teamMembersResults = await Promise.all(teamMemberPromises);
        const allTeamMemberIds = new Set<number>();
        teamMembersResults.forEach((result: any) => {
          (result.members || []).forEach((member: any) => {
            if (member.id !== user?.id) {
              allTeamMemberIds.add(member.id);
            }
          });
        });
        setTeamMemberIds(allTeamMemberIds);
        
      } catch (err: any) {
        console.error('Map data error:', err);
        if (!mounted) return;
        setError(err.message || 'Failed to load map data');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showRuns, user]);

  // Color scheme for territories
  const getTerritoryColors = (ownerId: number) => {
    // 🔵 Your Territory (Self)
    if (user && ownerId === user.id) {
      return {
        fillColor: '#1E88E5', // Strong Blue
        color: '#0D47A1', // Border
        fillOpacity: 0.40,
        weight: 2.5,
      };
    }
    
    // � Friends' Territories
    if (friendIds.has(ownerId)) {
      return {
        fillColor: '#43A047', // Green
        color: '#1B5E20', // Border
        fillOpacity: 0.35,
        weight: 2,
      };
    }
    
    // 🟣 Team Members' Territories
    if (teamMemberIds.has(ownerId)) {
      return {
        fillColor: '#8E24AA', // Purple
        color: '#6A1B9A', // Border
        fillOpacity: 0.35,
        weight: 2,
      };
    }
    
    // 🔴 Other Users / Global Players
    return {
      fillColor: '#E53935', // Red
      color: '#B71C1C', // Border
      fillOpacity: 0.35,
      weight: 2,
    };
  };

  // Color for run routes
  const getRunColor = (userId: number) => {
    if (user && userId === user.id) {
      return '#1E88E5'; // Blue for self
    }
    if (friendIds.has(userId)) {
      return '#43A047'; // Green for friends
    }
    if (teamMemberIds.has(userId)) {
      return '#8E24AA'; // Purple for team members
    }
    return '#E53935'; // Red for others
  };

  // Handle location button click
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        
        // Pan to user location
        if (mapInstance) {
          mapInstance.setView([latitude, longitude], 15, { animate: true });
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to retrieve your location. Please check your browser permissions.');
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-2xl border-2 border-gray-700">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-2xl border-2 border-red-900">
        <div className="text-center p-6">
          <p className="text-red-400 mb-2">Map Error</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden relative">
      <LocationButton onLocate={handleLocateUser} />
      
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        className="w-full h-full"
        zoomControl={true}
        style={{ minHeight: '400px' }}
        ref={setMapInstance}
      >
        {/* OpenStreetMap Tiles */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        {/* Territories (Polygons) */}
        {territories.map((territory) => {
          const coords = territory.geojson?.coordinates?.[0] || [];
          if (coords.length === 0) return null;
          
          // Convert from [lng, lat] to [lat, lng] for Leaflet
          const positions: LatLngExpression[] = coords.map(([lng, lat]) => [lat, lng]);
          const colors = getTerritoryColors(territory.owner_id);

          return (
            <Polygon
              key={territory.tile_id}
              positions={positions}
              pathOptions={colors}
            />
          );
        })}

        {/* Running Routes (Polylines) */}
        {showRuns && runs.map((run) => {
          const coords = run.geojson?.coordinates || [];
          if (coords.length === 0) return null;
          
          // Convert from [lng, lat] to [lat, lng] for Leaflet
          const positions: LatLngExpression[] = coords.map(([lng, lat]) => [lat, lng]);
          const color = getRunColor(run.user_id);

          return (
            <Polyline
              key={run.id}
              positions={positions}
              pathOptions={{
                color: color,
                weight: 3,
                opacity: 0.7,
              }}
            />
          );
        })}

        {/* User Location Marker */}
        {userLocation && (
          <>
            <Marker 
              position={userLocation} 
              icon={createUserLocationIcon()}
            />
            <Circle
              center={userLocation}
              radius={50}
              pathOptions={{
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                color: '#3b82f6',
                weight: 1,
                opacity: 0.4,
              }}
            />
          </>
        )}

        {/* Auto-fit bounds */}
        <MapBoundsHandler territories={territories} />
      </MapContainer>
    </div>
  );
};

export default RealTerritoryMap;
