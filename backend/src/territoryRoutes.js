import express from 'express';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { getRedisClient, isRedisAvailable } from './server.js';

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

    // Get all territories with run and owner details
    const query = `
      SELECT 
        t.*,
        u.username as owner_name,
        u.avatar_url,
        r.created_at as run_date
      FROM territories t
      LEFT JOIN users u ON t.owner_id = u.id
      LEFT JOIN runs r ON r.id = t.run_id
      ${ownerId ? 'WHERE t.owner_id = $1' : ''}
      ORDER BY t.created_at DESC
      ${ownerId ? 'LIMIT $2' : 'LIMIT $1'}
    `;
    
    const params = ownerId ? [ownerId, limit] : [limit];
    const { rows } = await pool.query(query, params);

    // Cache for 5 minutes
    await redisSetEx(cacheKey, 300, JSON.stringify(rows));

    return res.json({ ok: true, territories: rows });
  } catch (err) {
    console.error('Territory fetch failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch territories' });
  }
});

// Territories the user has created through their runs
router.get('/mine-history', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '500', 10), 2000);
    const userId = req.userId;
    const activityType = req.query.activityType; // 'cycle', 'run', or undefined for all
    const fields = req.query.fields; // 'lite' for minimal payload
    const cursor = req.query.cursor; // ISO timestamp for pagination

    // Field selection
    const selectFields = fields === 'lite' 
      ? 't.id, t.run_id, t.owner_id, t.activity_type, t.created_at, t.distance_km'
      : 't.*';

    let query = `
      SELECT ${selectFields}, u.username as owner_name
      FROM territories t
      LEFT JOIN users u ON t.owner_id = u.id
      WHERE t.owner_id = $1
      ${activityType ? 'AND t.activity_type = $2' : ''}
      ${cursor ? `AND t.created_at < $${activityType ? '3' : '2'}` : ''}
      ORDER BY t.created_at DESC
      LIMIT $${limit ? (activityType ? '4' : '3') : (activityType ? '2' : '1')}
    `;

    const params = [userId];
    if (activityType) params.push(activityType);
    if (cursor) params.push(cursor);
    params.push(limit);

    const { rows } = await pool.query(query, params);
    
    // Generate next cursor for pagination
    const nextCursor = rows.length === limit && rows.length > 0
      ? rows[rows.length - 1].created_at
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

// Get detailed territory info by run ID with overlapping territories and user stats
router.get('/:runId/info', async (req, res) => {
  try {
    const { runId } = req.params;
    const userId = req.user?.id || null;
    
    // Get main territory with owner info and run data
    const territoryQuery = `
      SELECT 
        t.id,
        t.run_id,
        t.owner_id,
        t.geojson,
        t.created_at,
        t.distance_km,
        t.activity_type,
        u.username as owner_name,
        u.avatar_url,
        r.distance_km as run_distance,
        r.duration_sec as run_duration,
        r.created_at as run_date
      FROM territories t
      LEFT JOIN users u ON t.owner_id = u.id
      LEFT JOIN runs r ON r.id = t.run_id
      WHERE t.run_id = $1
      LIMIT 1
    `;
    
    const { rows: territoryRows } = await pool.query(territoryQuery, [runId]);
    
    if (territoryRows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Territory not found' });
    }

    const territory = territoryRows[0];
    
    // Get overlapping territories (recent runs from all users)
    const overlappingQuery = `
      SELECT 
        t.id,
        t.run_id,
        t.owner_id,
        t.distance_km,
        t.activity_type,
        t.created_at,
        u.username as owner_name,
        u.avatar_url,
        r.duration_sec,
        r.distance_km as run_distance
      FROM territories t
      LEFT JOIN users u ON t.owner_id = u.id
      LEFT JOIN runs r ON r.id = t.run_id
      WHERE t.run_id != $1
        AND t.created_at >= NOW() - INTERVAL '30 days'
      ORDER BY t.created_at DESC
      LIMIT 50
    `;
    
    const { rows: overlappingRows } = await pool.query(overlappingQuery, [runId]);
    
    // Get top performers (last 30 days, sorted by distance)
    const topPerformersQuery = `
      SELECT 
        u.id,
        u.username,
        u.avatar_url,
        COUNT(*) as run_count,
        SUM(t.distance_km) as total_distance,
        AVG(t.distance_km) as avg_distance,
        MIN(CASE WHEN r.duration_sec > 0 AND t.distance_km > 0 THEN r.duration_sec / t.distance_km ELSE NULL END) as best_pace_sec_per_km
      FROM territories t
      LEFT JOIN users u ON t.owner_id = u.id
      LEFT JOIN runs r ON r.id = t.run_id
      WHERE t.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY u.id, u.username, u.avatar_url
      ORDER BY total_distance DESC
      LIMIT 10
    `;
    
    const { rows: topPerformersRows } = await pool.query(topPerformersQuery);
    
    return res.json({
      ok: true,
      territory,
      overlappingTerritories: overlappingRows,
      topPerformers: topPerformersRows,
      stats: {
        totalTerritoriesNearby: overlappingRows.length,
        topPerformerCount: topPerformersRows.length
      }
    });
  } catch (err) {
    console.error('Territory info fetch failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch territory info' });
  }
});

// Get territories grouped by activity type
router.get('/teams', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '500', 10), 2000);
    
    // Get territories with owner information
    const query = `
      SELECT 
        t.id,
        t.run_id,
        t.owner_id,
        t.geojson,
        t.created_at,
        t.activity_type,
        t.distance_km,
        tm.team_id,
        teams.name as team_name,
        teams.team_color
      FROM territories t
      LEFT JOIN team_members tm ON t.owner_id = tm.user_id AND tm.status = 'active'
      LEFT JOIN teams ON tm.team_id = teams.id
      ORDER BY t.created_at DESC
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
            total_distance: 0,
            territory_count: 0
          });
        }
        const teamData = teamTerritories.get(teamKey);
        teamData.territories.push({
          id: row.id,
          run_id: row.run_id,
          owner_id: row.owner_id,
          distance_km: row.distance_km,
          geojson: row.geojson,
          created_at: row.created_at,
          activity_type: row.activity_type
        });
        teamData.total_distance += parseFloat(row.distance_km || 0);
        teamData.territory_count += 1;
      } else {
        individualTerritories.push({
          id: row.id,
          run_id: row.run_id,
          owner_id: row.owner_id,
          distance_km: row.distance_km,
          geojson: row.geojson,
          created_at: row.created_at,
          activity_type: row.activity_type
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
