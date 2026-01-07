import express from 'express';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';

const router = express.Router();

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
