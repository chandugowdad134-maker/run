import express from 'express';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, visibility = 'public', scoring = 'territories', endsAt } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: 'Name required' });
    const { rows } = await pool.query(
      `INSERT INTO competitions (name, visibility, scoring, ends_at, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, visibility, scoring, endsAt || null, req.userId]
    );
    // auto-join creator
    await pool.query(
      `INSERT INTO competition_members (competition_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [rows[0].id, req.userId]
    );
    return res.status(201).json({ ok: true, competition: rows[0] });
  } catch (err) {
    console.error('Create competition failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to create competition' });
  }
});

router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query(
      `INSERT INTO competition_members (competition_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, req.userId]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('Join competition failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to join competition' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, COALESCE(members.count, 0) AS member_count
       FROM competitions c
       LEFT JOIN (
         SELECT competition_id, COUNT(*) AS count FROM competition_members GROUP BY competition_id
       ) members ON members.competition_id = c.id
       ORDER BY c.created_at DESC
       LIMIT 50`
    );
    return res.json({ ok: true, competitions: rows });
  } catch (err) {
    console.error('List competitions failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to list competitions' });
  }
});

router.get('/my-competitions', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, COALESCE(members.count, 0) AS member_count
       FROM competitions c
       JOIN competition_members cm ON c.id = cm.competition_id
       LEFT JOIN (
         SELECT competition_id, COUNT(*) AS count FROM competition_members GROUP BY competition_id
       ) members ON members.competition_id = c.id
       WHERE cm.user_id = $1
       ORDER BY c.created_at DESC`,
      [req.userId]
    );
    return res.json({ ok: true, competitions: rows });
  } catch (err) {
    console.error('List my competitions failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to list my competitions' });
  }
});

export default router;
