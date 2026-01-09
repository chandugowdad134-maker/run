import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from 'redis';
import { pool, verifyDatabaseConnection, ensureSchema } from './db.js';
import authRouter from './authRoutes.js';
import runRouter from './runRoutes.js';
import territoryRouter from './territoryRoutes.js';
import leaderboardRouter from './leaderboardRoutes.js';
import competitionRouter from './competitionRoutes.js';
import meRouter from './meRoute.js';
import friendRouter from './friendRoutes.js';
import teamRouter from './teamRoutes.js';
import notificationRouter from './notificationRoutes.js';
import privacyRouter from './privacyRoutes.js';
import statsRouter from './statsRoutes.js';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';


const app = express();
const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../../public');

// Redis client - lazy initialization
let redisClient = null;
let redisConnected = false;

function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => {
      redisConnected = false;
      // Only log Redis errors in development, warn in production
      if (process.env.NODE_ENV === 'development') {
        console.error('Redis Client Error', err);
      } else {
        console.warn('Redis not available');
      }
    });
    redisClient.on('connect', () => {
      redisConnected = true;
      console.log('Connected to Redis');
    });
  }
  return redisClient;
}

function isRedisAvailable() {
  return redisClient && redisConnected && redisClient.isOpen;
}

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Serve static assets (including favicon) from project public folder
app.use(express.static(publicDir));

app.use('/auth', authRouter);
app.use('/runs', runRouter);
app.use('/territories', territoryRouter);
app.use('/leaderboard', leaderboardRouter);
app.use('/competitions', competitionRouter);
app.use('/me', meRouter);
app.use('/friends', friendRouter);
app.use('/teams', teamRouter);
app.use('/notifications', notificationRouter);
app.use('/privacy', privacyRouter);
app.use('/stats', statsRouter);

// Serve a favicon to avoid noisy 404s when the API host is hit in a browser
app.get('/favicon.ico', (req, res) => {
  const faviconPath = path.resolve(__dirname, '../../public/favicon.ico');
  res.sendFile(faviconPath, err => {
    if (err) res.status(404).end();
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'API is running' });
});

app.get('/db-check', async (req, res) => {
  try {
    console.log('[DB Check] Testing database connection...');
    const ok = await verifyDatabaseConnection();
    const timeResult = await pool.query('SELECT NOW() as server_time');
    
    // Try to query territories and runs tables
    const territoryCount = await pool.query('SELECT COUNT(*) as count FROM territories');
    const runsCount = await pool.query('SELECT COUNT(*) as count FROM runs');
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');

    res.json({ 
      ok, 
      serverTime: timeResult.rows?.[0]?.server_time,
      tables: {
        territories: parseInt(territoryCount.rows[0].count),
        runs: parseInt(runsCount.rows[0].count),
        users: parseInt(usersCount.rows[0].count),
      }
    });
  } catch (error) {
    console.error('[DB Check] Database check failed:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

async function start() {
  try {
    console.log('[Server] Attempting database connection...');
    await verifyDatabaseConnection();
    console.log('[Server] Database connection verified');
    
    console.log('[Server] Ensuring schema...');
    await ensureSchema();
    console.log('[Server] Schema ready');

    // Note: Redis connection is lazy - will connect when first used
    // This prevents startup delays and allows the server to run without Redis

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] API ready on http://0.0.0.0:${PORT}`);
      console.log(`[Server] Accessible at http://localhost:${PORT} (local) and http://${getLocalIP()}:${PORT} (network)`);
      console.log(`[Server] NODE_ENV=${process.env.NODE_ENV}`);
      console.log(`[Server] Database=${process.env.DATABASE_URL ? 'configured' : 'NOT configured'}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error.message);
    console.error('[Server] Stack:', error.stack);
    console.error('[Server] DATABASE_URL is set?:', !!process.env.DATABASE_URL);
    process.exit(1);
  }
}

start();

// Export for use in routes
export { getRedisClient, isRedisAvailable };
