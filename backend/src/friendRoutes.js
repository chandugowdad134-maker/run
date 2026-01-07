import express from 'express';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';

const router = express.Router();

// Send friend request
router.post('/request', requireAuth, async (req, res) => {
  try {
    const { friendEmail } = req.body;
    if (!friendEmail) return res.status(400).json({ ok: false, error: 'Friend email required' });

    const friendResult = await pool.query('SELECT id FROM users WHERE email = $1', [friendEmail]);
    if (friendResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const friendId = friendResult.rows[0].id;
    if (friendId === req.userId) {
      return res.status(400).json({ ok: false, error: 'Cannot add yourself as friend' });
    }

    // Check if already exists
    const existing = await pool.query(
      'SELECT * FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [req.userId, friendId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ ok: false, error: 'Friendship already exists or pending' });
    }

    await pool.query(
      'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3)',
      [req.userId, friendId, 'pending']
    );

    // Create notification for friend
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        friendId,
        'friend_request',
        'New Friend Request',
        'Someone wants to connect with you',
        JSON.stringify({ from_user_id: req.userId })
      ]
    );

    res.json({ ok: true, message: 'Friend request sent' });
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ ok: false, error: 'Failed to send friend request' });
  }
});

// Accept friend request
router.post('/accept/:friendId', requireAuth, async (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId, 10);

    const result = await pool.query(
      'UPDATE friendships SET status = $1 WHERE user_id = $2 AND friend_id = $3 AND status = $4 RETURNING *',
      ['accepted', friendId, req.userId, 'pending']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Friend request not found' });
    }

    // Create reciprocal friendship
    await pool.query(
      'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.userId, friendId, 'accepted']
    );

    // Notify the requester
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        friendId,
        'friend_accepted',
        'Friend Request Accepted',
        'Your friend request was accepted',
        JSON.stringify({ from_user_id: req.userId })
      ]
    );

    res.json({ ok: true, message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend error:', error);
    res.status(500).json({ ok: false, error: 'Failed to accept friend request' });
  }
});

// Get friends list
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.username, u.avatar_url, f.status
       FROM friendships f
       JOIN users u ON (f.friend_id = u.id OR f.user_id = u.id)
       WHERE (f.user_id = $1 OR f.friend_id = $1) AND u.id != $1
       ORDER BY f.created_at DESC`,
      [req.userId]
    );

    res.json({ ok: true, friends: rows });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get friends' });
  }
});

// Remove friend
router.delete('/:friendId', requireAuth, async (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId, 10);

    await pool.query(
      'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [req.userId, friendId]
    );

    res.json({ ok: true, message: 'Friend removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ ok: false, error: 'Failed to remove friend' });
  }
});

export default router;
