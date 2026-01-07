import express from 'express';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';

const router = express.Router();

// Create privacy zone
router.post('/zones', requireAuth, async (req, res) => {
  try {
    const { name, geojson } = req.body;
    
    if (!name || !geojson) {
      return res.status(400).json({ ok: false, error: 'Name and geojson required' });
    }

    const result = await pool.query(
      'INSERT INTO privacy_zones (user_id, name, geojson) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, name, geojson]
    );

    res.json({ ok: true, zone: result.rows[0] });
  } catch (error) {
    console.error('Create privacy zone error:', error);
    res.status(500).json({ ok: false, error: 'Failed to create privacy zone' });
  }
});

// Get user's privacy zones
router.get('/zones', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM privacy_zones WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );

    res.json({ ok: true, zones: rows });
  } catch (error) {
    console.error('Get privacy zones error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get privacy zones' });
  }
});

// Update privacy zone
router.put('/zones/:zoneId', requireAuth, async (req, res) => {
  try {
    const zoneId = parseInt(req.params.zoneId, 10);
    const { name, geojson } = req.body;

    const result = await pool.query(
      'UPDATE privacy_zones SET name = COALESCE($1, name), geojson = COALESCE($2, geojson) WHERE id = $3 AND user_id = $4 RETURNING *',
      [name, geojson, zoneId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Privacy zone not found' });
    }

    res.json({ ok: true, zone: result.rows[0] });
  } catch (error) {
    console.error('Update privacy zone error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update privacy zone' });
  }
});

// Delete privacy zone
router.delete('/zones/:zoneId', requireAuth, async (req, res) => {
  try {
    const zoneId = parseInt(req.params.zoneId, 10);

    await pool.query(
      'DELETE FROM privacy_zones WHERE id = $1 AND user_id = $2',
      [zoneId, req.userId]
    );

    res.json({ ok: true, message: 'Privacy zone deleted' });
  } catch (error) {
    console.error('Delete privacy zone error:', error);
    res.status(500).json({ ok: false, error: 'Failed to delete privacy zone' });
  }
});

export default router;
