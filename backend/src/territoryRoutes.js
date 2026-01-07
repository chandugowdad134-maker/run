import express from 'express';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '500', 10), 2000);
    const ownerId = req.query.ownerId ? parseInt(req.query.ownerId, 10) : null;
    const rows = ownerId
      ? (await pool.query('SELECT * FROM territories WHERE owner_id = $1 ORDER BY last_claimed DESC LIMIT $2', [ownerId, limit])).rows
      : (await pool.query('SELECT * FROM territories ORDER BY last_claimed DESC LIMIT $1', [limit])).rows;
    return res.json({ ok: true, territories: rows });
  } catch (err) {
    console.error('Territory fetch failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch territories' });
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

export default router;
