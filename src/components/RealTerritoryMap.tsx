import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, useMap, Circle, Marker } from 'react-leaflet';
import { LatLngExpression, Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiFetch } from '@/lib/api';
import { Crosshair, Plus, Minus, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Switch } from '@/components/ui/switch';
import { db } from '@/lib/db';
import { polygonFromTile } from '@/lib/territory';

type Territory = {
  tile_id: string;
  owner_id: number;
  strength: number;
  geojson: {
    type: 'Feature';
    geometry: {
      type: 'Polygon';
      coordinates: number[][][];
    };
    properties?: any;
  };
  team_id?: number;
  activity_type?: 'run' | 'cycle';
};

type TeamTerritory = {
  team_id: number;
  team_name: string;
  team_color: string;
  territories: Territory[];
  total_strength: number;
  tile_count: number;
};

type Run = {
  id: number;
  user_id: number;
  geojson: {
    type: 'Feature';
    geometry: {
      type: 'Polygon' | 'LineString';
      coordinates: number[][] | number[][][];
    };
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

// Custom Zoom Controls
function ZoomButtons({ onZoomIn, onZoomOut }: { onZoomIn: () => void; onZoomOut: () => void }) {
  return (
    <div className="absolute top-2 left-2 z-[800] flex flex-col gap-1">
      <button
        onClick={onZoomIn}
        className="bg-white hover:bg-gray-50 text-gray-700 rounded-lg shadow-lg p-2.5 transition-all border border-gray-200"
        title="Zoom in"
      >
        <Plus className="w-5 h-5" />
      </button>
      <button
        onClick={onZoomOut}
        className="bg-white hover:bg-gray-50 text-gray-700 rounded-lg shadow-lg p-2.5 transition-all border border-gray-200"
        title="Zoom out"
      >
        <Minus className="w-5 h-5" />
      </button>
    </div>
  );
}

// Location button component
function LocationButton({ onLocate }: { onLocate: () => void }) {
  return (
    <button
      onClick={onLocate}
      className="absolute top-2 right-2 z-[800] bg-white hover:bg-gray-50 text-gray-700 rounded-lg shadow-lg p-2.5 transition-all border border-gray-200"
      title="Show my location"
    >
      <Crosshair className="w-5 h-5" />
    </button>
  );
}

// Team toggle component
function TeamToggle({ enabled, onToggle }: { enabled: boolean; onToggle: (enabled: boolean) => void }) {
  return (
    <div className="absolute bottom-20 right-2 z-[800] bg-white rounded-lg shadow-lg p-3 transition-all border border-gray-200">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-gray-700" />
        <span className="text-sm font-medium text-gray-700">Team View</span>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
    </div>
  );
}

function CyclingOnlyToggle({ enabled, onToggle, visible }: { enabled: boolean; onToggle: (enabled: boolean) => void; visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="absolute bottom-32 right-2 z-[800] bg-white rounded-lg shadow-lg p-3 transition-all border border-gray-200">
      <div className="flex items-center gap-2">
        <span className="text-sm">🚴</span>
        <span className="text-sm font-medium text-gray-700">Cycling Only</span>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
    </div>
  );
}

type MapFilter = 'mine' | 'friends' | 'present';

type TerritoryInfo = {
  tile_id: string;
  owner_id: number;
  owner_name: string;
  strength: number;
  last_claimed: string;
  distance_km?: number;
  duration_sec?: number;
  history: Array<{
    from_owner: number;
    from_owner_name: string;
    to_owner: number;
    to_owner_name: string;
    changed_at: string;
  }>;
};

const RealTerritoryMap = ({ center, zoom = 13, showRuns = false, filter = 'present' }: { 
  center?: [number, number]; 
  zoom?: number;
  showRuns?: boolean;
  filter?: MapFilter;
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
  const [teamViewEnabled, setTeamViewEnabled] = useState(false);
  const [teamTerritories, setTeamTerritories] = useState<TeamTerritory[]>([]);
  const [individualTerritories, setIndividualTerritories] = useState<Territory[]>([]);
  const [myTeamId, setMyTeamId] = useState<number | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryInfo | null>(null);
  const [showTerritoryPopup, setShowTerritoryPopup] = useState(false);
  const [cyclingOnly, setCyclingOnly] = useState(false);
  const [mineHistoryTerritories, setMineHistoryTerritories] = useState<Territory[] | null>(null);

  useEffect(() => {
    if (filter !== 'mine' && cyclingOnly) {
      setCyclingOnly(false);
    }
  }, [filter, cyclingOnly]);

  useEffect(() => {
    let mounted = true;

    if (filter !== 'mine' || !user) {
      setMineHistoryTerritories(null);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const activityParam = cyclingOnly ? '&activityType=cycle' : '';
        // Use fields=lite for smaller payload (we only need tile_id, owner_id, activity_type for rendering)
        const res = await apiFetch(`/territories/mine-history?limit=1000&fields=lite${activityParam}`);
        if (!mounted) return;
        setMineHistoryTerritories(res.territories || []);
        // Future: handle pagination using res.nextCursor if res.hasMore is true
      } catch (err) {
        if (!mounted) return;
        // Fallback: Mine filter will use current-owned tiles only.
        setMineHistoryTerritories([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [filter, user, cyclingOnly]);

  // Get user location on mount
  useEffect(() => {
    if (!center) {
      // Try to use cached location from sessionStorage first for instant display
      const cachedLocation = sessionStorage.getItem('last_location');
      if (cachedLocation) {
        try {
          const { lat, lng, timestamp } = JSON.parse(cachedLocation);
          // Use cached location if less than 5 minutes old
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            const location: [number, number] = [lat, lng];
            setUserLocation(location);
            setInitialCenter(location);
            console.log('Using cached location');
          }
        } catch (e) {
          console.log('Invalid cached location');
        }
      }
      
      // Still request fresh location in background
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const location: [number, number] = [latitude, longitude];
            setUserLocation(location);
            setInitialCenter(location);
            // Update cache
            sessionStorage.setItem('last_location', JSON.stringify({
              lat: latitude,
              lng: longitude,
              timestamp: Date.now()
            }));
          },
          (error) => {
            console.log('Location access denied or unavailable, using cached/default location');
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          }
        );
      }
    } else if (center) {
      setInitialCenter(center);
    }
  }, [center]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Load cached territories first
        const cachedTerritories = await db.territories.toArray();
        const now = Date.now();
        const CACHE_TTL = 60 * 60 * 1000; // 1 hour
        const validCache = cachedTerritories.filter(t => (now - t.lastUpdated) < CACHE_TTL);
        
        if (validCache.length > 0) {
          const territoriesFromCache = validCache.map(t => ({
            tile_id: t.tileId,
            owner_id: parseInt(t.ownerId),
            strength: t.strength,
            geojson: t.geometry || polygonFromTile(t.tileId)
          }));
          setTerritories(territoriesFromCache);
        }

        // Then fetch fresh data in background
        console.log('Fetching territories, runs, friends, and teams...');
        const [terrData, teamTerrData, runData, friendsData, teamsData] = await Promise.all([
          apiFetch('/territories?limit=500'),
          apiFetch('/territories/teams?limit=500').catch(err => {
            console.warn('Team territories not available:', err);
            return { teams: [], individual: [] };
          }),
          showRuns ? apiFetch('/runs?limit=100') : Promise.resolve({ runs: [] }),
          apiFetch('/friends').catch(() => ({ friends: [] })),
          apiFetch('/teams/my-teams').catch(() => ({ teams: [] }))
        ]);
        
        console.log('Territories:', terrData.territories?.length || 0);
        console.log('Team Territories:', teamTerrData.teams?.length || 0);
        console.log('Runs:', runData.runs?.length || 0);
        console.log('Friends:', friendsData.friends?.length || 0);
        console.log('Teams:', teamsData.teams?.length || 0);
        
        if (!mounted) return;
        setTerritories(terrData.territories || []);
        setTeamTerritories(teamTerrData.teams || []);
        setIndividualTerritories(teamTerrData.individual || []);
        setRuns(runData.runs || []);
        
        // Cache territories
        await db.territories.clear();
        for (const terr of terrData.territories || []) {
          await db.territories.put({
            tileId: terr.tile_id,
            ownerId: terr.owner_id.toString(),
            strength: terr.strength,
            geometry: terr.geojson,
            lastUpdated: Date.now()
          });
        }
        
        // Get user's team ID
        if (teamsData.teams?.length > 0) {
          setMyTeamId(teamsData.teams[0].id);
        }
        
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
    
    // 🟢 Friends' Territories
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

  // Color scheme for team territories
  const getTeamTerritoryColors = (teamId: number, teamColor: string) => {
    // Your team - use custom team color with higher opacity
    if (myTeamId && teamId === myTeamId) {
      return {
        fillColor: teamColor,
        color: teamColor,
        fillOpacity: 0.45,
        weight: 2.5,
      };
    }
    
    // Other teams - use their team color but more transparent
    return {
      fillColor: teamColor,
      color: teamColor,
      fillOpacity: 0.30,
      weight: 2,
    };
  };

  // Filter territories based on active filter
  const getFilteredTerritories = () => {
    if (!user) return territories;
    
    switch (filter) {
      case 'mine':
        // Phase 2: show territories the user has ever owned/claimed.
        // Fallback: if historical list is not loaded, show currently owned.
        return (mineHistoryTerritories ?? territories).filter((t) => {
          const isMineHistoryKnown = mineHistoryTerritories !== null;
          if (!isMineHistoryKnown) {
            if (t.owner_id !== user.id) return false;
          }
          if (cyclingOnly) return t.activity_type === 'cycle';
          return true;
        });
      case 'friends':
        // Show only friends and team members' territories
        return territories.filter(t => 
          friendIds.has(t.owner_id) || teamMemberIds.has(t.owner_id)
        );
      case 'present':
      default:
        // Show all territories (current ownership map)
        return territories;
    }
  };

  // Filter runs based on active filter
  const getFilteredRuns = () => {
    if (!user) return runs;
    
    switch (filter) {
      case 'mine':
        // Show all user's runs
        return runs.filter(r => r.user_id === user.id);
      case 'friends':
        // Show only friends and team members' runs
        return runs.filter(r => 
          friendIds.has(r.user_id) || teamMemberIds.has(r.user_id)
        );
      case 'present':
      default:
        // Show all runs
        return runs;
    }
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

  // Handle zoom in
  const handleZoomIn = () => {
    if (mapInstance) {
      mapInstance.zoomIn();
    }
  };

  // Handle zoom out
  const handleZoomOut = () => {
    if (mapInstance) {
      mapInstance.zoomOut();
    }
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

  // Handle territory click - fetch and show info
  const handleTerritoryClick = async (tileId: string) => {
    try {
      const response = await apiFetch(`/territories/${tileId}/info`);
      setSelectedTerritory(response.territory);
      setShowTerritoryPopup(true);
    } catch (error) {
      console.error('Failed to load territory info:', error);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeDiff = (date1: string, date2: string) => {
    const diff = new Date(date1).getTime() - new Date(date2).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
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
      {/* Territory Info Popup */}
      {showTerritoryPopup && selectedTerritory && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
             onClick={() => setShowTerritoryPopup(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Territory Info</h3>
              <button 
                onClick={() => setShowTerritoryPopup(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600 font-medium">Owner</span>
                <span className="text-gray-900 font-bold">{selectedTerritory.owner_name}</span>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600 font-medium">Strength</span>
                <span className="text-gray-900 font-bold">{selectedTerritory.strength}</span>
              </div>
              
              {selectedTerritory.distance_km != null && (
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600 font-medium">Distance</span>
                  <span className="text-gray-900 font-bold">{parseFloat(selectedTerritory.distance_km).toFixed(2)} km</span>
                </div>
              )}
              
              {selectedTerritory.duration_sec != null && (
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600 font-medium">Time</span>
                  <span className="text-gray-900 font-bold">{formatDuration(selectedTerritory.duration_sec)}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600 font-medium">Last Claimed</span>
                <span className="text-gray-900 text-sm">
                  {new Date(selectedTerritory.last_claimed).toLocaleDateString()}
                </span>
              </div>
              
              {selectedTerritory.history && selectedTerritory.history.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">History</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedTerritory.history.map((event, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-700">
                            <span className="font-medium">{event.to_owner_name}</span> conquered from{' '}
                            <span className="font-medium">{event.from_owner_name}</span>
                          </span>
                        </div>
                        <div className="text-gray-500 text-xs">
                          {new Date(event.changed_at).toLocaleString()}
                          {idx > 0 && (
                            <span className="ml-2">
                              ({formatTimeDiff(event.changed_at, selectedTerritory.history[idx - 1].changed_at)} later)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ZoomButtons onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />
      <LocationButton onLocate={handleLocateUser} />
      <CyclingOnlyToggle enabled={cyclingOnly} onToggle={setCyclingOnly} visible={filter === 'mine'} />
      <TeamToggle enabled={teamViewEnabled} onToggle={setTeamViewEnabled} />
      
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        className="w-full h-full"
        zoomControl={false}
        style={{ minHeight: '400px' }}
        ref={setMapInstance}
      >
        
        {/* OpenStreetMap Tiles */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        {/* Territories - Team View or Individual View */}
        {teamViewEnabled ? (
          // Team View: Show territories grouped by teams
          <>
            {teamTerritories.map((team) => 
              team.territories.map((territory) => {
                const coords = territory.geojson?.geometry?.coordinates?.[0] || [];
                if (coords.length === 0) return null;
                
                const positions: LatLngExpression[] = coords.map(([lng, lat]) => [lat, lng]);
                const colors = getTeamTerritoryColors(team.team_id, team.team_color);

                return (
                  <Polygon
                    key={territory.tile_id}
                    positions={positions}
                    pathOptions={colors}
                    eventHandlers={{
                      click: () => handleTerritoryClick(territory.tile_id)
                    }}
                  />
                );
              })
            )}
            {/* Individual territories (no team) */}
            {individualTerritories.map((territory) => {
              const coords = territory.geojson?.geometry?.coordinates?.[0] || [];
              if (coords.length === 0) return null;
              
              const positions: LatLngExpression[] = coords.map(([lng, lat]) => [lat, lng]);
              const colors = getTerritoryColors(territory.owner_id);

              return (
                <Polygon
                  key={territory.tile_id}
                  positions={positions}
                  pathOptions={colors}
                  eventHandlers={{
                    click: () => handleTerritoryClick(territory.tile_id)
                  }}
                />
              );
            })}
          </>
        ) : (
          // Individual View: Show territories with personal colors
          getFilteredTerritories().map((territory) => {
            const coords = territory.geojson?.geometry?.coordinates?.[0] || [];
            if (coords.length === 0) return null;
            
            const positions: LatLngExpression[] = coords.map(([lng, lat]) => [lat, lng]);
            const colors = (() => {
              const base = getTerritoryColors(territory.owner_id);
              if (filter === 'mine' && territory.owner_id === user?.id && territory.activity_type === 'cycle') {
                return {
                  ...base,
                  fillColor: '#8E24AA',
                  color: '#6A1B9A',
                  fillOpacity: 0.45,
                  weight: 2.5,
                };
              }
              return base;
            })();

            return (
              <>
                <Polygon
                  key={territory.tile_id}
                  positions={positions}
                  pathOptions={colors}
                  eventHandlers={{
                    click: () => handleTerritoryClick(territory.tile_id)
                  }}
                />
                {/* Activity Type Badge */}
                {territory.activity_type === 'cycle' && territory.owner_id === user?.id && (
                  <Marker
                    position={[positions[0][0], positions[0][1]]}
                    icon={new DivIcon({
                      html: '<div style="background: white; border-radius: 50%; padding: 2px 6px; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚴</div>',
                      className: '',
                      iconSize: [24, 24],
                    })}
                  />
                )}
              </>
            );
          })
        )}

        {/* Running Routes (Polylines) - Filtered */}
        {showRuns && getFilteredRuns().map((run) => {
          const coords = run.geojson?.geometry?.coordinates || [];
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
        <MapBoundsHandler territories={getFilteredTerritories()} />
      </MapContainer>
    </div>
  );
};

export default RealTerritoryMap;
