import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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


const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'API is running' });
});

app.get('/db-check', async (req, res) => {
  try {
    const ok = await verifyDatabaseConnection();
    const timeResult = await pool.query('SELECT NOW() as server_time');

    res.json({ ok, serverTime: timeResult.rows?.[0]?.server_time });
  } catch (error) {
    console.error('Database check failed:', error);
    res.status(500).json({ ok: false, error: 'Database connection failed' });
  }
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

async function start() {
  try {
    await verifyDatabaseConnection();
    await ensureSchema();
    console.log('Connected to database');

    app.listen(PORT, () => {
      console.log(`API ready on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
