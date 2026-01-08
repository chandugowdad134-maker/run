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

// Remove team member (admin only)
router.delete('/:teamId/members/:userId', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    const userIdToRemove = parseInt(req.params.userId, 10);

    // Check if requester is admin of the team
    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.userId]
    );

    if (!memberCheck.rows[0] || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Only team admins can remove members' });
    }

    // Prevent admin from removing themselves (they should use leave)
    if (userIdToRemove === req.userId) {
      return res.status(400).json({ ok: false, error: 'Use leave endpoint to remove yourself' });
    }

    // Remove the member
    const result = await pool.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 RETURNING *',
      [teamId, userIdToRemove]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Member not found in team' });
    }

    res.json({ ok: true, message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ ok: false, error: 'Failed to remove member' });
  }
});

// Generate invitation code for team
router.post('/:teamId/invitations', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    const { expiresInDays, maxUses } = req.body;

    // Check if user is admin of the team
    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.userId]
    );

    if (!memberCheck.rows[0] || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Only team admins can create invitations' });
    }

    // Generate unique invitation code
    const invitationCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

    const { rows } = await pool.query(
      `INSERT INTO team_invitations (team_id, invitation_code, created_by, expires_at, max_uses)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [teamId, invitationCode, req.userId, expiresAt, maxUses || null]
    );

    res.json({ ok: true, invitation: rows[0] });
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({ ok: false, error: 'Failed to create invitation' });
  }
});

// Get team invitations
router.get('/:teamId/invitations', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);

    // Check if user is member of the team
    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.userId]
    );

    if (!memberCheck.rows[0]) {
      return res.status(403).json({ ok: false, error: 'Only team members can view invitations' });
    }

    const { rows } = await pool.query(
      `SELECT ti.*, u.username as created_by_name
       FROM team_invitations ti
       LEFT JOIN users u ON ti.created_by = u.id
       WHERE ti.team_id = $1
       ORDER BY ti.created_at DESC`,
      [teamId]
    );

    res.json({ ok: true, invitations: rows });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get invitations' });
  }
});

// Join team via invitation code
router.post('/join-by-invite', requireAuth, async (req, res) => {
  try {
    const { invitationCode } = req.body;

    if (!invitationCode) {
      return res.status(400).json({ ok: false, error: 'Invitation code required' });
    }

    // Find valid invitation
    const inviteResult = await pool.query(
      `SELECT ti.*, t.name as team_name
       FROM team_invitations ti
       JOIN teams t ON ti.team_id = t.id
       WHERE ti.invitation_code = $1
       AND (ti.expires_at IS NULL OR ti.expires_at > NOW())
       AND (ti.max_uses IS NULL OR ti.current_uses < ti.max_uses)`,
      [invitationCode]
    );

    if (!inviteResult.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Invalid or expired invitation code' });
    }

    const invitation = inviteResult.rows[0];

    // Check if already a member
    const memberCheck = await pool.query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [invitation.team_id, req.userId]
    );

    if (memberCheck.rows[0]) {
      return res.status(400).json({ ok: false, error: 'Already a member of this team' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Add user to team
      await client.query(
        'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
        [invitation.team_id, req.userId, 'member']
      );

      // Increment invitation usage count
      await client.query(
        'UPDATE team_invitations SET current_uses = current_uses + 1 WHERE id = $1',
        [invitation.id]
      );

      await client.query('COMMIT');

      res.json({ 
        ok: true, 
        message: `Successfully joined ${invitation.team_name}`,
        teamId: invitation.team_id 
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Join by invite error:', error);
    res.status(500).json({ ok: false, error: 'Failed to join team' });
  }
});

// Update team settings (admin only)
router.patch('/:teamId/settings', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    const { visibility, name, description } = req.body;

    // Check if user is admin
    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.userId]
    );

    if (!memberCheck.rows[0] || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Only team admins can update settings' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (visibility !== undefined) {
      updates.push(`visibility = $${paramCount++}`);
      values.push(visibility);
    }
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'No updates provided' });
    }

    values.push(teamId);
    const { rows } = await pool.query(
      `UPDATE teams SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ ok: true, team: rows[0] });
  } catch (error) {
    console.error('Update team settings error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update team settings' });
  }
});

// Delete invitation (admin only)
router.delete('/invitations/:invitationId', requireAuth, async (req, res) => {
  try {
    const invitationId = parseInt(req.params.invitationId, 10);

    // Check if user is admin of the team
    const inviteCheck = await pool.query(
      `SELECT ti.team_id, tm.role
       FROM team_invitations ti
       LEFT JOIN team_members tm ON ti.team_id = tm.team_id AND tm.user_id = $1
       WHERE ti.id = $2`,
      [req.userId, invitationId]
    );

    if (!inviteCheck.rows[0] || inviteCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Only team admins can delete invitations' });
    }

    await pool.query('DELETE FROM team_invitations WHERE id = $1', [invitationId]);

    res.json({ ok: true, message: 'Invitation deleted successfully' });
  } catch (error) {
    console.error('Delete invitation error:', error);
    res.status(500).json({ ok: false, error: 'Failed to delete invitation' });
  }
});

// ========== TEAM STATS & DASHBOARD ==========

// Get team overview stats
router.get('/:teamId/stats', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);

    // Verify member
    const memberCheck = await pool.query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.userId]
    );

    if (!memberCheck.rows[0]) {
      return res.status(403).json({ ok: false, error: 'Not a team member' });
    }

    // Get or create team stats
    const statsResult = await pool.query(
      `INSERT INTO team_stats (team_id) VALUES ($1)
       ON CONFLICT (team_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [teamId]
    );

    // Calculate real-time stats
    const aggregateResult = await pool.query(
      `SELECT 
         COALESCE(SUM(r.distance_km), 0) as total_distance,
         COALESCE(COUNT(DISTINCT r.id), 0) as total_runs,
         COALESCE(COUNT(DISTINCT t.id), 0) as territories_owned,
         COALESCE(COUNT(DISTINCT tm.user_id), 0) as member_count,
         COALESCE(SUM(CASE WHEN r.created_at >= NOW() - INTERVAL '7 days' THEN r.distance_km ELSE 0 END), 0) as weekly_distance,
         COALESCE(SUM(CASE WHEN r.created_at >= NOW() - INTERVAL '30 days' THEN r.distance_km ELSE 0 END), 0) as monthly_distance
       FROM team_members tm
       LEFT JOIN runs r ON tm.user_id = r.user_id
       LEFT JOIN territories t ON tm.user_id = t.owner_id
       WHERE tm.team_id = $1`,
      [teamId]
    );

    const stats = { ...statsResult.rows[0], ...aggregateResult.rows[0] };

    res.json({ ok: true, stats });
  } catch (error) {
    console.error('Get team stats error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get team stats' });
  }
});

// Get member contributions
router.get('/:teamId/contributions', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);

    const { rows } = await pool.query(
      `SELECT 
         u.id,
         u.username,
         u.avatar_url,
         tm.role,
         COALESCE(SUM(r.distance_km), 0) as distance_contributed,
         COALESCE(COUNT(DISTINCT r.id), 0) as runs_contributed,
         COALESCE(COUNT(DISTINCT t.id), 0) as territories_contributed,
         MAX(r.created_at) as last_run_at,
         ROUND((COALESCE(SUM(r.distance_km), 0) / NULLIF((
           SELECT SUM(r2.distance_km) 
           FROM team_members tm2 
           JOIN runs r2 ON tm2.user_id = r2.user_id 
           WHERE tm2.team_id = $1
         ), 0) * 100), 1) as contribution_percentage
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       LEFT JOIN runs r ON tm.user_id = r.user_id
       LEFT JOIN territories t ON tm.user_id = t.owner_id
       WHERE tm.team_id = $1
       GROUP BY u.id, u.username, u.avatar_url, tm.role
       ORDER BY distance_contributed DESC`,
      [teamId]
    );

    res.json({ ok: true, contributions: rows });
  } catch (error) {
    console.error('Get contributions error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get contributions' });
  }
});

// ========== TEAM CHALLENGES ==========

// Create team challenge
router.post('/:teamId/challenges', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    const { type, title, description, targetValue, endsAt } = req.body;

    // Check admin
    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.userId]
    );

    if (!memberCheck.rows[0] || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Only admins can create challenges' });
    }

    const { rows } = await pool.query(
      `INSERT INTO team_challenges (team_id, type, title, description, target_value, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [teamId, type, title, description, targetValue, endsAt]
    );

    // Add to feed
    await pool.query(
      `INSERT INTO team_feed (team_id, user_id, activity_type, data)
       VALUES ($1, $2, 'challenge_created', $3)`,
      [teamId, req.userId, JSON.stringify({ challenge_id: rows[0].id, title })]
    );

    res.json({ ok: true, challenge: rows[0] });
  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({ ok: false, error: 'Failed to create challenge' });
  }
});

// Get team challenges
router.get('/:teamId/challenges', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    const { status } = req.query;

    let query = `SELECT * FROM team_challenges WHERE team_id = $1`;
    const params = [teamId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const { rows } = await pool.query(query, params);

    res.json({ ok: true, challenges: rows });
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get challenges' });
  }
});

// Update challenge progress
router.patch('/:teamId/challenges/:challengeId', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    const challengeId = parseInt(req.params.challengeId, 10);
    const { currentValue, status } = req.body;

    const updates = [];
    const values = [challengeId, teamId];
    let paramCount = 3;

    if (currentValue !== undefined) {
      updates.push(`current_value = $${paramCount++}`);
      values.push(currentValue);
    }

    if (status) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'No updates provided' });
    }

    const { rows } = await pool.query(
      `UPDATE team_challenges 
       SET ${updates.join(', ')}
       WHERE id = $1 AND team_id = $2
       RETURNING *`,
      values
    );

    res.json({ ok: true, challenge: rows[0] });
  } catch (error) {
    console.error('Update challenge error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update challenge' });
  }
});

// ========== TEAM FEED ==========

// Get team activity feed
router.get('/:teamId/feed', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    const { limit = 50 } = req.query;

    const { rows } = await pool.query(
      `SELECT 
         tf.*,
         u.username,
         u.avatar_url
       FROM team_feed tf
       JOIN users u ON tf.user_id = u.id
       WHERE tf.team_id = $1
       ORDER BY tf.created_at DESC
       LIMIT $2`,
      [teamId, limit]
    );

    res.json({ ok: true, feed: rows });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get feed' });
  }
});

// Add activity to feed (called by other routes)
async function addTeamActivity(teamId, userId, activityType, data) {
  try {
    await pool.query(
      `INSERT INTO team_feed (team_id, user_id, activity_type, data)
       VALUES ($1, $2, $3, $4)`,
      [teamId, userId, activityType, JSON.stringify(data)]
    );
  } catch (error) {
    console.error('Add feed activity error:', error);
  }
}

export { addTeamActivity };
export default router;
