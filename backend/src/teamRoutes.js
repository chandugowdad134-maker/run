import express from 'express';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';

const router = express.Router();

// Create team
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: 'Team name required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const teamResult = await client.query(
        'INSERT INTO teams (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
        [name, description, req.userId]
      );

      const team = teamResult.rows[0];

      // Add creator as admin
      await client.query(
        'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
        [team.id, req.userId, 'admin']
      );

      await client.query('COMMIT');
      res.json({ ok: true, team });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ ok: false, error: 'Failed to create team' });
  }
});

// Get all teams
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, 
              u.username as creator_name,
              COUNT(tm.user_id)::int as member_count
       FROM teams t
       LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN team_members tm ON t.id = tm.team_id
       GROUP BY t.id, u.username
       ORDER BY t.created_at DESC`
    );

    res.json({ ok: true, teams: rows });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get teams' });
  }
});

// Get user's teams
router.get('/my-teams', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, tm.role,
              COUNT(tm2.user_id)::int as member_count
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       LEFT JOIN team_members tm2 ON t.id = tm2.team_id
       WHERE tm.user_id = $1
       GROUP BY t.id, tm.role
       ORDER BY t.created_at DESC`,
      [req.userId]
    );

    res.json({ ok: true, teams: rows });
  } catch (error) {
    console.error('Get my teams error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get teams' });
  }
});

// Join team
router.post('/:teamId/join', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);

    await pool.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [teamId, req.userId, 'member']
    );

    res.json({ ok: true, message: 'Joined team successfully' });
  } catch (error) {
    console.error('Join team error:', error);
    res.status(500).json({ ok: false, error: 'Failed to join team' });
  }
});

// Leave team
router.post('/:teamId/leave', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);

    await pool.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.userId]
    );

    res.json({ ok: true, message: 'Left team successfully' });
  } catch (error) {
    console.error('Leave team error:', error);
    res.status(500).json({ ok: false, error: 'Failed to leave team' });
  }
});

// Get team members
router.get('/:teamId/members', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);

    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.email, u.avatar_url, tm.role, tm.joined_at
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at`,
      [teamId]
    );

    res.json({ ok: true, members: rows });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get team members' });
  }
});

export default router;
