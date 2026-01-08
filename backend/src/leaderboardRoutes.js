import express from 'express';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';

const router = express.Router();

// Global leaderboard - all users
router.get('/global', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.email, s.total_distance_km, s.territories_owned, s.area_km2
       FROM user_stats s 
       JOIN users u ON u.id = s.user_id
       ORDER BY s.total_distance_km DESC
       LIMIT $1`,
      [limit]
    );
    return res.json({ ok: true, leaderboard: rows });
  } catch (err) {
    console.error('Global leaderboard fetch failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch global leaderboard' });
  }
});

// Friends leaderboard
router.get('/friends', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.email, s.total_distance_km, s.territories_owned, s.area_km2
       FROM user_stats s 
       JOIN users u ON u.id = s.user_id
       WHERE u.id IN (
         SELECT friend_id FROM friendships WHERE user_id = $1 AND status = 'accepted'
         UNION
         SELECT user_id FROM friendships WHERE friend_id = $1 AND status = 'accepted'
       )
       ORDER BY s.total_distance_km DESC
       LIMIT $2`,
      [req.userId, limit]
    );
    return res.json({ ok: true, leaderboard: rows });
  } catch (err) {
    console.error('Friends leaderboard fetch failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch friends leaderboard' });
  }
});

// Teams leaderboard
router.get('/teams', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const { rows } = await pool.query(
      `SELECT 
         t.id, 
         t.name, 
         t.team_color,
         COUNT(DISTINCT tm.user_id) as member_count,
         COALESCE(SUM(tms.distance_contributed_km), 0) as total_distance,
         COALESCE(SUM(tms.territories_contributed), 0) as total_territories
       FROM teams t
       LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.status = 'active'
       LEFT JOIN team_member_stats tms ON t.id = tms.team_id
       GROUP BY t.id, t.name, t.team_color
       ORDER BY total_distance DESC
       LIMIT $1`,
      [limit]
    );
    return res.json({ ok: true, leaderboard: rows });
  } catch (err) {
    console.error('Teams leaderboard fetch failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch teams leaderboard' });
  }
});

// Legacy endpoint - keep for backwards compatibility
router.get('/', requireAuth, async (req, res) => {
  try {
    const type = (req.query.type || 'distance').toString();
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);
    let orderBy = 'total_distance_km DESC';
    if (type === 'territories') orderBy = 'territories_owned DESC';
    if (type === 'area') orderBy = 'area_km2 DESC';
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.username, s.total_distance_km, s.territories_owned, s.area_km2
       FROM user_stats s JOIN users u ON u.id = s.user_id
       ORDER BY ${orderBy}
       LIMIT $1`,
      [limit]
    );
    return res.json({ ok: true, leaderboard: rows });
  } catch (err) {
    console.error('Leaderboard fetch failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch leaderboard' });
  }
});

export default router;
