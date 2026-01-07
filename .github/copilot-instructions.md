# TerritoryRun - AI Agent Instructions

## Project Overview
A GPS-accurate territory conquest running app where users claim real-world territory by running. Built with React/Vite frontend + Node.js/Express backend with PostgreSQL/PostGIS.

**Core Principle**: 1 km run in real world = 1 km on map (Haversine formula, ±0.5% accuracy)

## Architecture

### Frontend (Vite + React + TypeScript)
- **Entry**: `src/main.tsx` → `App.tsx` (routes via React Router)
- **Auth Flow**: `AuthContext.tsx` manages JWT tokens (localStorage), `ProtectedRoute.tsx` guards routes
- **API Layer**: `src/lib/api.ts` - wrapper around fetch with JWT auth headers
- **Key Pages**: `Home.tsx`, `ActiveRun.tsx` (live GPS tracking), `Profile.tsx`, `Social.tsx`, `Competitions.tsx`

### Backend (Node.js + Express)
- **Entry**: `backend/src/server.js` - initializes DB schema, starts on port 4000
- **Database**: PostgreSQL with schema auto-created via `db.js` → `ensureSchema()`
- **Routes**: Modular routers (`authRoutes.js`, `runRoutes.js`, `territoryRoutes.js`, etc.)
- **Auth Middleware**: `backend/src/middleware/auth.js` - JWT verification via `requireAuth`

## Critical GPS/Geospatial Logic

### Distance Calculation (`src/lib/geoutils.ts`)
```typescript
// Haversine formula - ALWAYS use this for GPS distance
calculateDistance(lat1, lon1, lat2, lon2) // → meters
calculateTotalDistance(points) // → km (sums segments)
```

### Territory Acquisition (`backend/src/runRoutes.js`)
1. Validate GPS points (speed < 10 m/s anti-cheat)
2. Create LineString from `[lng, lat]` pairs (note: longitude first!)
3. Apply 50m buffer using `@turf/turf` → `turfBuffer(line, 0.05, {units: 'kilometers'})`
4. Store buffered polygon as GeoJSON in `territories` table with `tile_id` (H3-style grid)

**Key Pattern**: Backend uses **Turf.js** for geospatial ops; frontend uses **Haversine** for display calculations

### Coordinate Systems
- **Storage**: GeoJSON format with `[longitude, latitude]` order (RFC 7946)
- **Display**: Leaflet maps use `[latitude, longitude]` order
- **Always verify**: When converting between systems, check lng/lat vs lat/lng order

## Development Workflow

### Setup
```bash
# Frontend
npm install
npm run dev  # Vite dev server on http://localhost:5173

# Backend (separate terminal)
cd backend
npm install
cp .env.example .env  # Edit DATABASE_URL, JWT_SECRET
npm run dev  # Node --watch on http://localhost:4000
```

### Mobile Apps (Android/iOS)
```bash
# Build web app and sync to mobile
npm run build
npx cap sync

# Open in IDE
npm run mobile:android  # Android Studio
npm run mobile:ios      # Xcode (macOS only)

# Quick commands
npm run cap:build       # Build + sync both platforms
```

See `MOBILE_QUICK_START.md` for complete mobile setup.

### Environment Variables
- **Backend** (`backend/.env`):
  - `DATABASE_URL`: PostgreSQL connection string (required)
  - `JWT_SECRET`: Token signing key (required)
- **Frontend**: `VITE_API_URL` (defaults to `http://localhost:4000`)

### Database Management
- Schema auto-creates on server start via `ensureSchema()` in `backend/src/db.js`
- No migrations folder - schema is declarative in `db.js` using `CREATE TABLE IF NOT EXISTS`
- PostGIS not currently enabled but planned (territory storage uses JSONB GeoJSON)

## Code Conventions

### API Communication
- **Frontend**: Use `api.get()`, `api.post()`, etc. from `src/lib/api.ts` (auto-adds JWT)
- **Backend**: Protect routes with `requireAuth` middleware → adds `req.userId`
- **Response Format**: `{ ok: true, ...data }` on success, `{ ok: false, error: string }` on failure
- **Important**: API responses return data at top level (e.g., `response.competitions`), not nested in `.data`

### Component Patterns
- **UI Components**: shadcn/ui components in `src/components/ui/` (Radix + Tailwind)
- **Map Components**: `RealTerritoryMap.tsx` (static territories), `LiveRunMap.tsx` (active tracking)
- **State**: React Query (`@tanstack/react-query`) for server state, Context API for auth

### Backend Data Flow
1. Route handler validates request
2. `pool.query()` for simple queries, `pool.connect()` + transactions for multi-step operations
3. Always use parameterized queries (`$1, $2`) - never string interpolation
4. Return JSON with `ok` boolean flag

## Key Files Reference

### Geospatial
- `src/lib/geoutils.ts`: Haversine distance, speed validation, bounds calculation
- `backend/src/runRoutes.js`: Territory acquisition logic, Turf.js buffering
- `backend/src/grid.js`: H3-style tile ID generation (zoom-based grid system)

### Auth & API
- `src/contexts/AuthContext.tsx`: JWT token management, user profile state
- `backend/src/middleware/auth.js`: JWT verification, extracts userId from token
- `src/lib/api.ts`: Centralized fetch wrapper with auth headers

### Documentation
- `GPS_TERRITORY_SYSTEM.md`: Complete geospatial system architecture
- `IMPLEMENTATION_COMPLETE.md`: Feature checklist and implementation details

## Common Tasks

### Adding a New API Endpoint
1. Create route in `backend/src/` (e.g., `newFeatureRoutes.js`)
2. Import and mount in `server.js`: `app.use('/newfeature', newFeatureRouter)`
3. Add frontend API call in relevant component using `api.post('/newfeature/...')`

### Working with GPS Data
- Always validate points: check `typeof lat/lng === 'number'`
- Use `maxSegmentSpeed()` anti-cheat (10 m/s threshold)
- Frontend: high-accuracy GPS via `enableHighAccuracy: true` in geolocation options
- Store raw GPS points with timestamps for replay/validation

### Territory Rendering
- Use `RealTerritoryMap` component with Leaflet + OpenStreetMap tiles
- Territories are GeoJSON Polygons with `owner_id` for coloring
- Auto-fit bounds using `getBounds()` from `geoutils.ts`
