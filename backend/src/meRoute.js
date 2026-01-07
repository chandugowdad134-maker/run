import express from 'express';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows: userRows } = await pool.query('SELECT id, email, username, created_at FROM users WHERE id = $1', [req.userId]);
    if (userRows.length === 0) return res.status(404).json({ ok: false, error: 'User not found' });
    const user = userRows[0];
    const { rows: statRows } = await pool.query(
      'SELECT total_distance_km, territories_owned, area_km2, updated_at FROM user_stats WHERE user_id = $1',
      [req.userId]
    );
    const stats = statRows[0] || { total_distance_km: 0, territories_owned: 0, area_km2: 0, updated_at: null };
    return res.json({ ok: true, user: { ...user, stats } });
  } catch (err) {
    console.error('Me fetch failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load profile' });
  }
});

export default router;
