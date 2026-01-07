import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret';
const TOKEN_EXPIRY = '7d';

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set; using a dev-only fallback. Set JWT_SECRET in .env for production.');
}

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedUsername = username ? String(username).trim() : normalizedEmail.split('@')[0];

    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ ok: false, error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, username, created_at',
      [normalizedEmail, passwordHash, normalizedUsername]
    );

    const user = result.rows[0];
    const token = signToken(user.id);

    return res.status(201).json({ ok: true, token, user: { id: user.id, email: user.email, username: user.username } });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ ok: false, error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await pool.query('SELECT id, email, username, password_hash FROM users WHERE email = $1', [normalizedEmail]);

    if (result.rowCount === 0) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const token = signToken(user.id);
    return res.json({ ok: true, token, user: { id: user.id, email: user.email, username: user.username } });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

export default router;
