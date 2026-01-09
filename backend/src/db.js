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
    
    -- Anti-cheat system columns
    ALTER TABLE runs ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'run';
    ALTER TABLE runs ADD COLUMN IF NOT EXISTS validation_status JSONB;
    ALTER TABLE runs ADD COLUMN IF NOT EXISTS raw_points JSONB;
    ALTER TABLE runs ADD COLUMN IF NOT EXISTS max_speed NUMERIC;
    ALTER TABLE runs ADD COLUMN IF NOT EXISTS avg_accuracy NUMERIC;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS territories (
      id SERIAL PRIMARY KEY,
      run_id INTEGER UNIQUE NOT NULL REFERENCES runs(id),
      owner_id INTEGER REFERENCES users(id),
      geojson JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      activity_type TEXT,
      distance_km NUMERIC
    );
  `);

  // Migrate from old tile-based schema to run-based schema
  await pool.query(`
    DO $$ 
    BEGIN
      -- Check if tile_id column exists (old schema)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'territories' AND column_name = 'tile_id'
      ) THEN
        -- Drop old tile-based columns and indexes
        DROP INDEX IF EXISTS idx_territories_tile_id;
        ALTER TABLE territories DROP COLUMN IF EXISTS tile_id;
        ALTER TABLE territories DROP COLUMN IF EXISTS strength;
        ALTER TABLE territories DROP COLUMN IF EXISTS last_claimed;
        
        -- Add run_id if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'territories' AND column_name = 'run_id'
        ) THEN
          ALTER TABLE territories ADD COLUMN run_id INTEGER UNIQUE REFERENCES runs(id);
        END IF;
      END IF;
    END $$;
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
      is_team_based BOOLEAN DEFAULT false,
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
    ALTER TABLE team_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
  `);

  // Add team enhancements
  await pool.query(`
    ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS invitation_code TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS team_color TEXT DEFAULT '#7C3AED';
  `);

  // Team invitations for managing invite links
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_invitations (
      id SERIAL PRIMARY KEY,
      team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
      invitation_code TEXT UNIQUE NOT NULL,
      created_by INTEGER REFERENCES users(id),
      expires_at TIMESTAMPTZ,
      max_uses INTEGER,
      current_uses INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Team competitions linking teams to competitions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_competitions (
      team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
      competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
      score INTEGER DEFAULT 0,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (team_id, competition_id)
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
    ALTER TABLE territory_claims ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'run';
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

  // Add team competition support
  await pool.query(`
    ALTER TABLE competitions
    ADD COLUMN IF NOT EXISTS is_team_based BOOLEAN DEFAULT false;
  `);

  // Add team system enhancements
  await pool.query(`
    ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS team_color TEXT DEFAULT '#8B5CF6',
    ADD COLUMN IF NOT EXISTS team_avatar TEXT,
    ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '{"min_distance_m": 500, "max_daily_distance_km": 20, "territory_decay_days": 7, "friendly_fire": false}'::jsonb;
  `);

  // Team challenges table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_challenges (
      id SERIAL PRIMARY KEY,
      team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      target_value NUMERIC NOT NULL,
      current_value NUMERIC DEFAULT 0,
      starts_at TIMESTAMPTZ DEFAULT NOW(),
      ends_at TIMESTAMPTZ,
      status TEXT DEFAULT 'active',
      reward JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Team feed/activity
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_feed (
      id SERIAL PRIMARY KEY,
      team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      activity_type TEXT NOT NULL,
      data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Team stats (cached aggregations)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_stats (
      team_id INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
      total_distance_km NUMERIC DEFAULT 0,
      total_runs INTEGER DEFAULT 0,
      territory_owned_km2 NUMERIC DEFAULT 0,
      active_members INTEGER DEFAULT 0,
      weekly_distance_km NUMERIC DEFAULT 0,
      monthly_distance_km NUMERIC DEFAULT 0,
      rank_city INTEGER,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Team member stats (individual contributions)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_member_stats (
      team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      distance_contributed_km NUMERIC DEFAULT 0,
      runs_contributed INTEGER DEFAULT 0,
      territories_contributed INTEGER DEFAULT 0,
      last_run_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (team_id, user_id)
    );
  `);

  // Add team_id to territories for team ownership
  await pool.query(`
    ALTER TABLE territories
    ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id),
    ADD COLUMN IF NOT EXISTS ownership_percentage NUMERIC DEFAULT 100;
  `);

  // Add username as unique if not already
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;
  `);

  // Indexes for performance
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_territories_run_id ON territories(run_id);
    CREATE INDEX IF NOT EXISTS idx_territories_owner ON territories(owner_id);
    CREATE INDEX IF NOT EXISTS idx_territories_team ON territories(team_id) WHERE team_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id);
    CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_territory_history_tile ON territory_history(tile_id);
    CREATE INDEX IF NOT EXISTS idx_territory_history_to_owner ON territory_history(to_owner);
    CREATE INDEX IF NOT EXISTS idx_territory_history_to_owner_tile ON territory_history(to_owner, tile_id);
    CREATE INDEX IF NOT EXISTS idx_territory_claims_user ON territory_claims(user_id);
    CREATE INDEX IF NOT EXISTS idx_territory_claims_user_tile ON territory_claims(user_id, tile_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id) WHERE read = false;
    CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_teams_invitation_code ON teams(invitation_code) WHERE invitation_code IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_team_invitations_code ON team_invitations(invitation_code);
    CREATE INDEX IF NOT EXISTS idx_team_competitions_team ON team_competitions(team_id);
    CREATE INDEX IF NOT EXISTS idx_team_challenges_team ON team_challenges(team_id, status);
    CREATE INDEX IF NOT EXISTS idx_team_feed_team ON team_feed(team_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_team_member_stats ON team_member_stats(team_id, user_id);
  `);
}
