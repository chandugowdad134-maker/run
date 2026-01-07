import express from 'express';
import { lineString, length as turfLength, buffer as turfBuffer } from '@turf/turf';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { tileIdFromCoord, polygonFromTile, tileAreaKm2 } from './grid.js';

const router = express.Router();
const MAX_SPEED_M_S = 10; // simple fair-play threshold
const BUFFER_KM = 0.05; // ~50m buffer around path

// GET /runs - Fetch recent runs
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const { rows } = await pool.query(
      'SELECT id, user_id, geojson, distance_km, duration_sec, created_at FROM runs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return res.json({ runs: rows });
  } catch (error) {
    console.error('Fetch runs error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to fetch runs' });
  }
});

function validateRun(points = []) {
  if (!Array.isArray(points) || points.length < 2) return 'At least two points required';
  for (const p of points) {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return 'Invalid lat/lng';
  }
  return null;
}

function maxSegmentSpeed(points) {
  let max = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dt = (b.timestamp && a.timestamp) ? (b.timestamp - a.timestamp) / 1000 : null;
    if (!dt || dt <= 0) continue;
    const dx = haversine(a, b); // meters
    const speed = dx / dt;
    if (speed > max) max = speed;
  }
  return max;
}

function haversine(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLon / 2);
  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const { points = [], distanceKm, durationSec } = req.body || {};
    const validationError = validateRun(points);
    if (validationError) return res.status(400).json({ ok: false, error: validationError });

    const maxSpeed = maxSegmentSpeed(points);
    if (maxSpeed > MAX_SPEED_M_S) {
      return res.status(400).json({ ok: false, error: 'Run rejected: speed too high (possible vehicle).' });
    }

    const line = lineString(points.map((p) => [p.lng, p.lat]));
    const computedDistance = distanceKm ?? turfLength(line, { units: 'kilometers' });
    const buffered = turfBuffer(line, BUFFER_KM, { units: 'kilometers' });

    // Determine tiles touched based on points (fast) and fallback to centroid of buffered polygon
    const tileIds = new Set(points.map((p) => tileIdFromCoord(p.lat, p.lng)));
    if (tileIds.size === 0 && buffered?.geometry?.coordinates?.length) {
      const [lng, lat] = buffered.geometry.coordinates[0][0];
      tileIds.add(tileIdFromCoord(lat, lng));
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const runInsert = await client.query(
        'INSERT INTO runs (user_id, geojson, distance_km, duration_sec) VALUES ($1, $2, $3, $4) RETURNING id',
        [req.userId, buffered, computedDistance, durationSec ?? null]
      );
      const runId = runInsert.rows[0].id;

      const updatedTiles = [];
      for (const tileId of tileIds) {
        const tilePoly = polygonFromTile(tileId);
        const { rows } = await client.query('SELECT * FROM territories WHERE tile_id = $1', [tileId]);
        if (rows.length === 0) {
          await client.query(
            'INSERT INTO territories (tile_id, owner_id, strength, geojson, last_claimed) VALUES ($1, $2, $3, $4, NOW())',
            [tileId, req.userId, 1, tilePoly]
          );
          await client.query(
            'INSERT INTO territory_history (tile_id, from_owner, to_owner) VALUES ($1, NULL, $2)',
            [tileId, req.userId]
          );
          updatedTiles.push({ tileId, ownerId: req.userId, strength: 1, flipped: true });
        } else {
          const t = rows[0];
          if (t.owner_id === req.userId) {
            const strength = t.strength + 1;
            await client.query('UPDATE territories SET strength = $1, last_claimed = NOW() WHERE tile_id = $2', [strength, tileId]);
            updatedTiles.push({ tileId, ownerId: req.userId, strength, flipped: false });
          } else {
            const strength = t.strength - 1;
            if (strength <= 0) {
              await client.query(
                'UPDATE territories SET owner_id = $1, strength = 1, last_claimed = NOW() WHERE tile_id = $2',
                [req.userId, tileId]
              );
              await client.query(
                'INSERT INTO territory_history (tile_id, from_owner, to_owner) VALUES ($1, $2, $3)',
                [tileId, t.owner_id, req.userId]
              );
              updatedTiles.push({ tileId, ownerId: req.userId, strength: 1, flipped: true });
            } else {
              await client.query('UPDATE territories SET strength = $1, last_claimed = NOW() WHERE tile_id = $2', [strength, tileId]);
              updatedTiles.push({ tileId, ownerId: t.owner_id, strength, flipped: false });
            }
          }
        }
      }

      // Update user stats
      await client.query(
        `INSERT INTO user_stats (user_id, total_distance_km, territories_owned, area_km2)
         VALUES ($1, $2, 0, 0)
         ON CONFLICT (user_id) DO UPDATE SET total_distance_km = user_stats.total_distance_km + $2, updated_at = NOW()`,
        [req.userId, computedDistance]
      );
      // Refresh owned counts
      const { rows: ownedRows } = await client.query('SELECT COUNT(*)::int AS c FROM territories WHERE owner_id = $1', [req.userId]);
      const owned = ownedRows[0].c || 0;
      const areaKm2 = owned * tileAreaKm2(Array.from(tileIds)[0]);
      await client.query(
        'UPDATE user_stats SET territories_owned = $1, area_km2 = $2, updated_at = NOW() WHERE user_id = $3',
        [owned, areaKm2, req.userId]
      );

      await client.query('COMMIT');
      return res.json({ ok: true, runId, updatedTiles });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Run ingest failed:', err);
      return res.status(500).json({ ok: false, error: 'Run ingest failed' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Run error:', error);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

export default router;
