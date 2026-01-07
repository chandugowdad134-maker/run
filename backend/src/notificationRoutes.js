import express from 'express';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';

const router = express.Router();

// Get user notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const unreadOnly = req.query.unread === 'true';

    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    const params = [req.userId];

    if (unreadOnly) {
      query += ' AND read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT $2';
    params.push(limit);

    const { rows } = await pool.query(query, params);

    res.json({ ok: true, notifications: rows });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get notifications' });
  }
});

// Mark notification as read
router.patch('/:notificationId/read', requireAuth, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.notificationId, 10);

    await pool.query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
      [notificationId, req.userId]
    );

    res.json({ ok: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ ok: false, error: 'Failed to mark notification' });
  }
});

// Mark all notifications as read
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false',
      [req.userId]
    );

    res.json({ ok: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ ok: false, error: 'Failed to mark all notifications' });
  }
});

// Delete notification
router.delete('/:notificationId', requireAuth, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.notificationId, 10);

    await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, req.userId]
    );

    res.json({ ok: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ ok: false, error: 'Failed to delete notification' });
  }
});

// Get unread count
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read = false',
      [req.userId]
    );

    res.json({ ok: true, count: rows[0].count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get unread count' });
  }
});

export default router;
