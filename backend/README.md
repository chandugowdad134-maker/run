# TerritoryRun Backend

This folder now contains a minimal Express + PostgreSQL API skeleton.

## Recommended Stack

- **Runtime**: Node.js with Express or Fastify
- **Database**: PostgreSQL with PostGIS extension
- **ORM**: Prisma or Drizzle
- **Auth**: JWT-based authentication

## Quick start

1) Copy environment template and set your database URL

```bash
cd backend
cp .env.example .env
# edit .env and set DATABASE_URL=postgresql://user:password@host:5432/territory_runner
```

2) Install dependencies (already added to package.json)

```bash
npm install
```

3) Run the API (default port 4000)

```bash
npm run dev
# or for production
npm start
```

4) Verify connectivity

- API health: `GET http://localhost:4000/health`
- Database connectivity and server time: `GET http://localhost:4000/db-check`

### Auth endpoints
- Register: `POST http://localhost:4000/auth/register` with JSON `{ "email": "user@example.com", "password": "secret123" }`
- Login: `POST http://localhost:4000/auth/login` with the same payload. Returns JWT token.

The server will refuse to start if `DATABASE_URL` is missing or invalid.

## Database setup (PostgreSQL + PostGIS suggested)

Enable PostGIS on your database once:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Suggested schema remains the same:

## Database Schema (Suggested)

```sql
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User stats table
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  territories_captured INT DEFAULT 0,
  total_distance DECIMAL(10,2) DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Territories table (PostGIS)
CREATE TABLE territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  polygon GEOMETRY(POLYGON, 4326) NOT NULL,
  captured_at TIMESTAMP DEFAULT NOW(),
  run_id UUID
);

-- Runs table
CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  route GEOMETRY(LINESTRING, 4326) NOT NULL,
  distance DECIMAL(10,2) NOT NULL,
  duration INT NOT NULL, -- seconds
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP NOT NULL,
  is_valid BOOLEAN DEFAULT true
);

-- Spatial indexes
CREATE INDEX idx_territories_polygon ON territories USING GIST(polygon);
CREATE INDEX idx_runs_route ON runs USING GIST(route);
```

## API Endpoints (Suggested)

### Auth
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login and get JWT
- `POST /api/auth/refresh` - Refresh JWT token

### Users
- `GET /api/users/me` - Get current user profile
- `PATCH /api/users/me` - Update profile
- `GET /api/users/:id/stats` - Get user stats

### Territories
- `GET /api/territories` - Get territories in viewport
- `POST /api/territories` - Claim new territory
- `GET /api/territories/mine` - Get user's territories

### Runs
- `POST /api/runs/start` - Start a new run
- `POST /api/runs/:id/location` - Add GPS point
- `POST /api/runs/:id/end` - End run and calculate territory
- `GET /api/runs/history` - Get run history

### Leaderboard
- `GET /api/leaderboard` - Global leaderboard
- `GET /api/leaderboard/local` - Local area leaderboard
