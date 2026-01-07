import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add it to your environment or .env file.');
}

export const pool = new Pool({ connectionString });

export async function verifyDatabaseConnection() {
  const result = await pool.query('SELECT 1 as ok');
  return result.rows?.[0]?.ok === 1;
}

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      username TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      total_distance_km NUMERIC DEFAULT 0,
      territories_owned INTEGER DEFAULT 0,
      area_km2 NUMERIC DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS runs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      geojson JSONB NOT NULL,
      distance_km NUMERIC,
      duration_sec INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS territories (
      id SERIAL PRIMARY KEY,
      tile_id TEXT UNIQUE NOT NULL,
      owner_id INTEGER REFERENCES users(id),
      strength INTEGER DEFAULT 1,
      geojson JSONB NOT NULL,
      last_claimed TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS territory_history (
      id SERIAL PRIMARY KEY,
      tile_id TEXT NOT NULL,
      from_owner INTEGER,
      to_owner INTEGER,
      changed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS competitions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      visibility TEXT DEFAULT 'public',
      scoring TEXT DEFAULT 'territories',
      starts_at TIMESTAMPTZ DEFAULT NOW(),
      ends_at TIMESTAMPTZ,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS competition_members (
      competition_id INTEGER REFERENCES competitions(id),
      user_id INTEGER REFERENCES users(id),
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (competition_id, user_id)
    );
  `);

  // Teams table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member',
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (team_id, user_id)
    );
  `);

  // Friends/Social connections
  await pool.query(`
    CREATE TABLE IF NOT EXISTS friendships (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, friend_id),
      CHECK (user_id != friend_id)
    );
  `);

  // Privacy zones
  await pool.query(`
    CREATE TABLE IF NOT EXISTS privacy_zones (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      geojson JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Run segments for detailed tracking
  await pool.query(`
    CREATE TABLE IF NOT EXISTS run_segments (
      id SERIAL PRIMARY KEY,
      run_id INTEGER REFERENCES runs(id) ON DELETE CASCADE,
      tile_id TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      speed_mps NUMERIC,
      valid BOOLEAN DEFAULT true
    );
  `);

  // Territory claims (detailed history of each claim action)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS territory_claims (
      id SERIAL PRIMARY KEY,
      tile_id TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id),
      run_id INTEGER REFERENCES runs(id),
      claimed_at TIMESTAMPTZ DEFAULT NOW(),
      distance_in_tile NUMERIC,
      time_in_tile INTEGER
    );
  `);

  // Notifications
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      data JSONB,
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Boss territories (high-value special zones)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS boss_territories (
      id SERIAL PRIMARY KEY,
      tile_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      difficulty INTEGER DEFAULT 1,
      required_players INTEGER DEFAULT 1,
      bonus_multiplier NUMERIC DEFAULT 2.0,
      active BOOLEAN DEFAULT true,
      geojson JSONB NOT NULL
    );
  `);

  // Achievement system
  await pool.query(`
    CREATE TABLE IF NOT EXISTS achievements (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      type TEXT NOT NULL,
      threshold NUMERIC
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
      earned_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, achievement_id)
    );
  `);

  // Update user_stats table with more fields
  await pool.query(`
    ALTER TABLE user_stats 
    ADD COLUMN IF NOT EXISTS longest_run_km NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_runs INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS territories_conquered INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS territories_lost INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS most_contested_tile TEXT;
  `);

  // Add username as unique if not already
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;
  `);

  // Indexes for performance
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_territories_tile_id ON territories(tile_id);
    CREATE INDEX IF NOT EXISTS idx_territories_owner ON territories(owner_id);
    CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id);
    CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_territory_history_tile ON territory_history(tile_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id) WHERE read = false;
    CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(user_id, status);
  `);
}
