# GPS-Accurate Territory Conquest System

## Overview

This application implements a **real-world GPS-accurate territory conquest running app** where every kilometer run in the physical world equals exactly 1 kilometer on the map. The system uses proper geospatial calculations and real geographic maps.

## Key Features

### 1. Real Geographic Maps
- **Map Library**: Leaflet with OpenStreetMap tiles
- **Accurate Coordinates**: All positions use actual latitude/longitude coordinates
- **Multi-Zoom Support**: Maps work correctly at all zoom levels
- **Live Tracking**: Real-time GPS position updates on the map during runs

### 2. GPS Distance Calculations

#### Haversine Formula
Used for calculating distances between GPS coordinates on Earth's surface:

```typescript
function calculateDistance(lat1, lon1, lat2, lon2): meters {
  R = 6,371,000 // Earth's radius in meters
  dLat = toRadians(lat2 - lat1)
  dLon = toRadians(lon2 - lon1)
  
  a = sin²(dLat/2) + cos(lat1) * cos(lat2) * sin²(dLon/2)
  c = 2 * atan2(√a, √(1-a))
  distance = R * c
  
  return distance in meters
}
```

**Accuracy**: ±0.5% for distances up to 1000km

### 3. Territory Acquisition System

#### Path-Based Territory
When a user runs, territory is acquired along their actual path:

1. **GPS Tracking**: High-accuracy GPS sampling (~1Hz)
2. **Path Recording**: LineString geometry in GeoJSON format
3. **Buffer Zone**: 50-meter buffer around the running path
4. **Territory Polygon**: Buffered area becomes claimable territory

#### Territory Formula
```
Territory Area = Buffer(RunPath, 50 meters)
```

For a 1km run:
- **Distance**: Exactly 1000 meters
- **Territory Width**: 100 meters (50m each side)
- **Total Area**: ~100,000 m² (0.1 km²)

### 4. Backend Geospatial Processing

#### PostGIS Database
```sql
-- Territories stored as real geographic polygons
CREATE TABLE territories (
  id SERIAL PRIMARY KEY,
  tile_id TEXT,
  owner_id INTEGER,
  geojson JSONB,  -- GeoJSON Polygon with ACTUAL coordinates
  strength INTEGER
);

-- Runs stored as LineStrings
CREATE TABLE runs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  geojson JSONB,  -- GeoJSON LineString [lng, lat] pairs
  distance_km NUMERIC,  -- Calculated via Haversine
  duration_sec INTEGER
);
```

#### Territory Generation Process

```javascript
// 1. Receive GPS points from user's run
const points = [
  { lat: 37.7749, lng: -122.4194, timestamp: 1234567890 },
  { lat: 37.7750, lng: -122.4195, timestamp: 1234567891 },
  // ... more points
];

// 2. Create LineString geometry
const lineString = turf.lineString(
  points.map(p => [p.lng, p.lat])
);

// 3. Calculate actual distance using Haversine
const distanceKm = turf.length(lineString, { units: 'kilometers' });

// 4. Create 50m buffer around path
const buffer = turf.buffer(lineString, 0.05, { units: 'kilometers' });

// 5. Store buffered polygon as territory
await db.query(
  'INSERT INTO territories (geojson, owner_id) VALUES ($1, $2)',
  [buffer, userId]
);
```

### 5. Anti-Cheat System

#### Speed Validation
```typescript
const MAX_HUMAN_SPEED = 10; // m/s (36 km/h)

function validateRun(points: GPSPoint[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const distance = calculateDistance(points[i-1], points[i]);
    const time = (points[i].timestamp - points[i-1].timestamp) / 1000;
    const speed = distance / time;
    
    if (speed > MAX_HUMAN_SPEED) {
      return false; // Possible vehicle or GPS spoofing
    }
  }
  return true;
}
```

#### GPS Accuracy Filtering
- Only accept GPS points with accuracy < 20 meters
- Display accuracy in real-time to user
- Warn users if GPS signal is poor

### 6. Real-Time Visualization

#### Live Run Tracking
```tsx
<LiveRunMap 
  gpsPoints={gpsPoints}
  currentPosition={currentPosition}
  isTracking={isRunning}
/>
```

Features:
- Auto-follows user's current position
- Shows complete running path
- Displays GPS accuracy circle
- Color-coded by tracking status

#### Territory Display
```tsx
<RealTerritoryMap 
  center={[lat, lng]}
  zoom={13}
  showRuns={true}
/>
```

Features:
- Displays all user territories as polygons
- Shows running routes as polylines
- Color-coded by owner
- Auto-fits bounds to show all territories
- Works at any zoom level

## Technical Stack

### Frontend
- **Map Library**: Leaflet + React-Leaflet
- **Tiles**: OpenStreetMap (free, open-source)
- **Geospatial Utils**: Custom Haversine implementation
- **State Management**: React hooks
- **Styling**: Tailwind CSS

### Backend
- **Database**: PostgreSQL 17 with PostGIS extension
- **Geometry Processing**: @turf/turf library
- **Storage Format**: GeoJSON (RFC 7946 compliant)
- **Coordinate System**: WGS84 (EPSG:4326)

## Data Flow

### Run Recording
```
1. User starts run
   ↓
2. GPS tracking begins (high accuracy mode)
   ↓
3. Points collected every ~1 second
   ↓
4. Distance calculated using Haversine formula
   ↓
5. User stops run
   ↓
6. Points sent to backend
   ↓
7. Backend validates speed/GPS accuracy
   ↓
8. LineString created from points
   ↓
9. 50m buffer applied to create territory polygon
   ↓
10. Territory saved to PostGIS database
    ↓
11. Map updated to show new territory
```

### Territory Display
```
1. User opens map
   ↓
2. Frontend requests territories from API
   ↓
3. Backend queries PostGIS: SELECT geojson, owner_id FROM territories
   ↓
4. GeoJSON polygons returned
   ↓
5. Leaflet renders polygons on OpenStreetMap
   ↓
6. Territories displayed at exact GPS coordinates
   ↓
7. Map pans/zooms maintain accuracy
```

## Configuration

### Territory Buffer Distance
Adjust in `backend/src/runRoutes.js`:
```javascript
const BUFFER_KM = 0.05; // 50 meters
```

### Max Speed Threshold
Adjust in `backend/src/runRoutes.js`:
```javascript
const MAX_SPEED_M_S = 10; // 10 m/s = 36 km/h
```

### GPS Accuracy Requirements
Adjust in `src/pages/ActiveRun.tsx`:
```typescript
enableHighAccuracy: true,
maximumAge: 0,
timeout: 5000,
```

## API Endpoints

### POST /runs
Save a completed run and claim territory

**Request**:
```json
{
  "points": [
    { "lat": 37.7749, "lng": -122.4194, "timestamp": 1234567890 },
    { "lat": 37.7750, "lng": -122.4195, "timestamp": 1234567891 }
  ],
  "distanceKm": 1.05,
  "durationSec": 360
}
```

**Response**:
```json
{
  "ok": true,
  "runId": 123,
  "updatedTiles": [
    { "tileId": "9q8yy", "ownerId": 1, "strength": 1, "flipped": true }
  ]
}
```

### GET /territories
Retrieve all territories

**Response**:
```json
{
  "territories": [
    {
      "tile_id": "9q8yy",
      "owner_id": 1,
      "strength": 3,
      "geojson": {
        "type": "Polygon",
        "coordinates": [[[lng, lat], [lng, lat], ...]]
      }
    }
  ]
}
```

## Performance Considerations

### GPS Sampling Rate
- **Recommended**: 1 Hz (1 point per second)
- **Minimum**: 0.2 Hz (1 point per 5 seconds)
- **Maximum**: 5 Hz (5 points per second, battery intensive)

### Territory Complexity
- Buffer resolution: 8 segments per quarter circle
- Simplification: ±1 meter tolerance
- Max vertices per polygon: ~100

### Database Indexing
```sql
-- Spatial index for fast territory queries
CREATE INDEX idx_territories_geom ON territories USING GIST(
  ST_GeomFromGeoJSON(geojson)
);

-- Tile ID index for ownership lookups
CREATE INDEX idx_territories_tile ON territories(tile_id);
```

## Future Enhancements

1. **Heatmap Visualization**: Intensity-based territory display
2. **3D Terrain**: Elevation-aware territory calculations
3. **Battle Zones**: Real-time contested areas
4. **Historical Playback**: Animate territory changes over time
5. **Satellite Imagery**: Toggle between map styles
6. **Offline Maps**: Pre-download tiles for remote areas

## Testing

### GPS Simulation
For development/testing without moving:

```typescript
// Simulate a 1km run in San Francisco
const simulatedPoints = generateCircularPath(
  { lat: 37.7749, lng: -122.4194 }, // center
  500, // radius in meters
  20   // number of points
);
```

### Territory Validation
```bash
# Verify territory accuracy using PostGIS
psql territory_runner -c "
  SELECT 
    tile_id,
    ST_Area(ST_GeomFromGeoJSON(geojson)::geography) / 1000000 as area_km2
  FROM territories;
"
```

## License

MIT License - See LICENSE file for details

---

**Built with**:  
🗺️ Leaflet • 📍 PostGIS • ⚡ React • 🏃 GPS Tracking
