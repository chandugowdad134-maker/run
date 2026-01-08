import express from 'express';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { getRedisClient, isRedisAvailable } from './server.js';
import { tileIdFromCoord } from './grid.js';

const router = express.Router();

// Helper function to safely use Redis
const redisGet = async (key) => {
  try {
    if (isRedisAvailable()) {
      const redis = getRedisClient();
      return await redis.get(key);
    }
  } catch (err) {
    console.warn('Redis get failed:', err.message);
  }
  return null;
};

const redisSetEx = async (key, ttl, value) => {
  try {
    if (isRedisAvailable()) {
      const redis = getRedisClient();
      await redis.setEx(key, ttl, value);
    }
  } catch (err) {
    console.warn('Redis set failed:', err.message);
  }
};

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '500', 10), 2000);
    const ownerId = req.query.ownerId ? parseInt(req.query.ownerId, 10) : null;
    const cacheKey = `territories:${ownerId || 'all'}:${limit}`;

    // Try cache first
    const cached = await redisGet(cacheKey);
    if (cached) {
      return res.json({ ok: true, territories: JSON.parse(cached), cached: true });
    }

    const rows = ownerId
      ? (await pool.query('SELECT * FROM territories WHERE owner_id = $1 ORDER BY last_claimed DESC LIMIT $2', [ownerId, limit])).rows
      : (await pool.query('SELECT * FROM territories ORDER BY last_claimed DESC LIMIT $1', [limit])).rows;

    // Cache for 5 minutes
    await redisSetEx(cacheKey, 300, JSON.stringify(rows));

    return res.json({ ok: true, territories: rows });
  } catch (err) {
    console.error('Territory fetch failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch territories' });
  }
});

// Territories the user has ever owned/claimed (includes tiles that were later lost)
router.get('/mine-history', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '500', 10), 2000);
    const userId = req.userId;
    const activityType = req.query.activityType; // 'cycle', 'run', or undefined for all
    const fields = req.query.fields; // 'lite' for minimal payload
    const cursor = req.query.cursor; // ISO timestamp for pagination

    // Field selection
    const selectFields = fields === 'lite' 
      ? 't.tile_id, t.owner_id, t.activity_type, t.last_claimed'
      : 't.*';

    const query = `
      WITH tiles AS (
        SELECT tile_id FROM territories WHERE owner_id = $1
        UNION
        SELECT tile_id FROM territory_history WHERE to_owner = $1
        UNION
        SELECT tile_id FROM territory_claims WHERE user_id = $1
          ${activityType ? 'AND activity_type = $3' : ''}
      )
      SELECT ${selectFields}
      FROM territories t
      JOIN tiles ON tiles.tile_id = t.tile_id
      ${cursor ? `WHERE t.last_claimed < $${activityType ? '4' : '3'}` : ''}
      ORDER BY t.last_claimed DESC
      LIMIT $2
    `;

    const params = [];
    params.push(userId, limit);
    if (activityType) params.push(activityType);
    if (cursor) params.push(cursor);

    const { rows } = await pool.query(query, params);
    
    // Generate next cursor for pagination
    const nextCursor = rows.length === limit && rows.length > 0
      ? rows[rows.length - 1].last_claimed
      : null;

    return res.json({ 
      ok: true, 
      territories: rows,
      nextCursor,
      hasMore: rows.length === limit
    });
  } catch (err) {
    console.error('Mine-history fetch failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch mine history territories' });
  }
});

router.get('/history/:tileId', requireAuth, async (req, res) => {
  try {
    const { tileId } = req.params;
    const rows = (await pool.query('SELECT * FROM territory_history WHERE tile_id = $1 ORDER BY changed_at DESC LIMIT 50', [tileId])).rows;
    return res.json({ ok: true, history: rows });
  } catch (err) {
    console.error('History fetch failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch history' });
  }
});

// Get detailed info about a territory (for click popup)
router.get('/:tileId/info', async (req, res) => {
  try {
    const { tileId } = req.params;
    
    // Get territory with owner info
    const territoryQuery = `
      SELECT 
        t.tile_id,
        t.owner_id,
        t.strength,
        t.last_claimed,
        u.username as owner_name,
        r.distance_km,
        r.duration_sec
      FROM territories t
      LEFT JOIN users u ON t.owner_id = u.id
      LEFT JOIN runs r ON r.user_id = t.owner_id AND r.id = (
        SELECT id FROM runs 
        WHERE user_id = t.owner_id 
        ORDER BY created_at DESC 
        LIMIT 1
      )
      WHERE t.tile_id = $1
    `;
    
    const { rows: territoryRows } = await pool.query(territoryQuery, [tileId]);
    
    if (territoryRows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Territory not found' });
    }
    
    // Get history with owner names
    const historyQuery = `
      SELECT 
        th.tile_id,
        th.from_owner,
        u1.username as from_owner_name,
        th.to_owner,
        u2.username as to_owner_name,
        th.changed_at
      FROM territory_history th
      LEFT JOIN users u1 ON th.from_owner = u1.id
      LEFT JOIN users u2 ON th.to_owner = u2.id
      WHERE th.tile_id = $1
      ORDER BY th.changed_at DESC
      LIMIT 10
    `;
    
    const { rows: historyRows } = await pool.query(historyQuery, [tileId]);
    
    return res.json({
      ok: true,
      territory: {
        ...territoryRows[0],
        history: historyRows
      }
    });
  } catch (err) {
    console.error('Territory info fetch failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch territory info' });
  }
});

// Get territory context for current location (with user's personal best)
router.post('/context', requireAuth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const userId = req.userId;

    if (!lat || !lng) {
      return res.status(400).json({ ok: false, error: 'Latitude and longitude required' });
    }

    // Approximate nearby territories (± ~100-150m) using geohash tiles (no PostGIS dependency)
    const offsets = [-0.001, 0, 0.001];
    const candidateTiles = new Set();
    for (const dLat of offsets) {
      for (const dLng of offsets) {
        candidateTiles.add(tileIdFromCoord(lat + dLat, lng + dLng));
      }
    }

    const candidateArray = Array.from(candidateTiles);
    const territories = await pool.query(
      `SELECT 
        t.tile_id,
        t.owner_id,
        t.last_claimed,
        t.strength,
        t.geojson,
        u.username as owner_name
      FROM territories t
      LEFT JOIN users u ON t.owner_id = u.id
      WHERE t.tile_id = ANY($1)
      ORDER BY t.last_claimed DESC
      LIMIT 9`,
      [candidateArray]
    );

    // Get user's previous runs in this area (within 50m)
    const userRunsQuery = `
      SELECT 
        r.id,
        r.distance_km,
        r.duration_sec,
        r.created_at,
        r.raw_points
      FROM runs r
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
      LIMIT 50
    `;

    const userRuns = await pool.query(userRunsQuery, [userId]);

    // Get fastest time for this user in this area
    let personalBest = null;
    if (userRuns.rows.length > 0) {
      const fastestRun = userRuns.rows.reduce((fastest, current) => {
        const pace = current.duration_sec / current.distance_km;
        const fastestPace = fastest.duration_sec / fastest.distance_km;
        return pace < fastestPace ? current : fastest;
      });

      personalBest = {
        runId: fastestRun.id,
        distanceKm: fastestRun.distance_km,
        durationSec: fastestRun.duration_sec,
        paceMinPerKm: (fastestRun.duration_sec / 60) / fastestRun.distance_km,
        date: fastestRun.created_at
      };
    }

    // Get territory ownership history
    const historyQuery = `
      SELECT 
        th.tile_id,
        th.from_owner,
        th.to_owner,
        th.changed_at,
        u1.username as from_owner_name,
        u2.username as to_owner_name
      FROM territory_history th
      LEFT JOIN users u1 ON th.from_owner = u1.id
      LEFT JOIN users u2 ON th.to_owner = u2.id
      WHERE th.tile_id = ANY($1)
      ORDER BY th.changed_at DESC
      LIMIT 20
    `;

    const tileIds = territories.rows.map(t => t.tile_id);
    const history = tileIds.length > 0 
      ? await pool.query(historyQuery, [tileIds])
      : { rows: [] };

    return res.json({
      ok: true,
      territories: territories.rows,
      personalBest,
      timesRunHere: userRuns.rows.length,
      history: history.rows
    });

  } catch (err) {
    console.error('Territory context fetch failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch territory context' });
  }
});

// Get territories grouped by teams
router.get('/teams', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '500', 10), 2000);
    
    // Get territories with team information
    const query = `
      SELECT 
        t.tile_id,
        t.owner_id,
        t.strength,
        t.geojson,
        t.last_claimed,
        tm.team_id,
        teams.name as team_name,
        teams.team_color
      FROM territories t
      LEFT JOIN team_members tm ON t.owner_id = tm.user_id AND tm.status = 'active'
      LEFT JOIN teams ON tm.team_id = teams.id
      ORDER BY t.last_claimed DESC
      LIMIT $1
    `;
    
    console.log('Fetching team territories with limit:', limit);
    const { rows } = await pool.query(query, [limit]);
    console.log('Found territories:', rows.length);
    
    // Group territories by team
    const teamTerritories = new Map();
    const individualTerritories = [];
    
    rows.forEach(row => {
      if (row.team_id) {
        const teamKey = row.team_id;
        if (!teamTerritories.has(teamKey)) {
          teamTerritories.set(teamKey, {
            team_id: row.team_id,
            team_name: row.team_name,
            team_color: row.team_color || '#7C3AED',
            territories: [],
            total_strength: 0,
            tile_count: 0
          });
        }
        const teamData = teamTerritories.get(teamKey);
        teamData.territories.push({
          tile_id: row.tile_id,
          owner_id: row.owner_id,
          strength: row.strength,
          geojson: row.geojson,
          last_claimed: row.last_claimed
        });
        teamData.total_strength += row.strength;
        teamData.tile_count += 1;
      } else {
        individualTerritories.push({
          tile_id: row.tile_id,
          owner_id: row.owner_id,
          strength: row.strength,
          geojson: row.geojson,
          last_claimed: row.last_claimed,
          team_id: null
        });
      }
    });
    
    console.log('Team groups:', teamTerritories.size, 'Individual:', individualTerritories.length);
    
    return res.json({ 
      ok: true, 
      teams: Array.from(teamTerritories.values()),
      individual: individualTerritories
    });
  } catch (err) {
    console.error('Team territories fetch failed:', err);
    console.error('Error stack:', err.stack);
    return res.status(500).json({ ok: false, error: 'Failed to fetch team territories', details: err.message });
  }
});

export default router;
