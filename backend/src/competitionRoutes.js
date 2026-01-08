import express from 'express';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, visibility = 'public', scoring = 'territories', endsAt, isTeamBased = false } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: 'Name required' });
    const { rows } = await pool.query(
      `INSERT INTO competitions (name, visibility, scoring, is_team_based, ends_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, visibility, scoring, isTeamBased, endsAt || null, req.userId]
    );
    // auto-join creator (only for individual competitions)
    if (!isTeamBased) {
      await pool.query(
        `INSERT INTO competition_members (competition_id, user_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [rows[0].id, req.userId]
      );
    }
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

// Join team to competition
router.post('/:id/teams/:teamId', requireAuth, async (req, res) => {
  try {
    const competitionId = parseInt(req.params.id, 10);
    const teamId = parseInt(req.params.teamId, 10);

    // Check if competition is team-based
    const compResult = await pool.query(
      'SELECT is_team_based FROM competitions WHERE id = $1',
      [competitionId]
    );

    if (!compResult.rows[0] || !compResult.rows[0].is_team_based) {
      return res.status(400).json({ ok: false, error: 'Competition is not team-based' });
    }

    // Check if user is member of the team
    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.userId]
    );

    if (!memberCheck.rows[0]) {
      return res.status(403).json({ ok: false, error: 'You are not a member of this team' });
    }

    // Join team to competition
    await pool.query(
      `INSERT INTO team_competitions (team_id, competition_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [teamId, competitionId]
    );

    return res.json({ ok: true, message: 'Team joined competition' });
  } catch (err) {
    console.error('Team join competition failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to join team to competition' });
  }
});

// Get team leaderboard for a competition
router.get('/:id/team-leaderboard', requireAuth, async (req, res) => {
  try {
    const competitionId = parseInt(req.params.id, 10);

    // Check if competition exists and is team-based
    const compResult = await pool.query(
      'SELECT is_team_based, scoring, starts_at, ends_at FROM competitions WHERE id = $1',
      [competitionId]
    );

    if (!compResult.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Competition not found' });
    }

    if (!compResult.rows[0].is_team_based) {
      return res.status(400).json({ ok: false, error: 'Competition is not team-based' });
    }

    const competition = compResult.rows[0];
    const { scoring, starts_at, ends_at } = competition;

    // Build query based on scoring type
    let scoreColumn = 'COALESCE(SUM(r.distance_km), 0)';
    let orderBy = 'total_score DESC';

    if (scoring === 'distance') {
      scoreColumn = 'COALESCE(SUM(r.distance_km), 0)';
    } else if (scoring === 'territories') {
      scoreColumn = 'COALESCE(COUNT(DISTINCT t.id), 0)';
    } else if (scoring === 'runs') {
      scoreColumn = 'COALESCE(COUNT(r.id), 0)';
    }

    // Get team standings
    const { rows } = await pool.query(
      `SELECT 
         teams.id,
         teams.name,
         teams.description,
         COUNT(DISTINCT tm.user_id) as member_count,
         ${scoreColumn} as total_score,
         COALESCE(SUM(r.distance_km), 0) as total_distance,
         COALESCE(COUNT(r.id), 0) as total_runs,
         COALESCE(COUNT(DISTINCT ter.id), 0) as territories_conquered
       FROM team_competitions tc
       JOIN teams ON tc.team_id = teams.id
       LEFT JOIN team_members tm ON teams.id = tm.team_id
       LEFT JOIN runs r ON tm.user_id = r.user_id 
         AND r.created_at >= $2
         AND ($3::timestamptz IS NULL OR r.created_at <= $3)
       LEFT JOIN territories ter ON tm.user_id = ter.owner_id
         AND ter.claimed_at >= $2
         AND ($3::timestamptz IS NULL OR ter.claimed_at <= $3)
       WHERE tc.competition_id = $1
       GROUP BY teams.id, teams.name, teams.description
       ORDER BY ${orderBy}
       LIMIT 100`,
      [competitionId, starts_at, ends_at]
    );

    return res.json({ ok: true, leaderboard: rows });
  } catch (err) {
    console.error('Get team leaderboard failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to get team leaderboard' });
  }
});

// Get teams in a competition
router.get('/:id/teams', requireAuth, async (req, res) => {
  try {
    const competitionId = parseInt(req.params.id, 10);

    const { rows } = await pool.query(
      `SELECT 
         t.id,
         t.name,
         t.description,
         t.visibility,
         COUNT(tm.user_id)::int as member_count,
         tc.joined_at
       FROM team_competitions tc
       JOIN teams t ON tc.team_id = t.id
       LEFT JOIN team_members tm ON t.id = tm.team_id
       WHERE tc.competition_id = $1
       GROUP BY t.id, t.name, t.description, t.visibility, tc.joined_at
       ORDER BY tc.joined_at`,
      [competitionId]
    );

    return res.json({ ok: true, teams: rows });
  } catch (err) {
    console.error('Get competition teams failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to get teams' });
  }
});

export default router;
