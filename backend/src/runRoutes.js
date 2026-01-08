import express from 'express';
import { lineString, length as turfLength, buffer as turfBuffer } from '@turf/turf';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { tileIdFromCoord, polygonFromTile, tileAreaKm2 } from './grid.js';
import { validateRunSubmission } from './antiCheat.js';
import { getRedisClient, isRedisAvailable } from './server.js';

const router = express.Router();
const BUFFER_KM = 0.05; // ~50m buffer around path

// Helper function to safely use Redis
const redisDel = async (pattern) => {
  try {
    if (isRedisAvailable()) {
      const redis = getRedisClient();
      await redis.del(pattern);
    }
  } catch (err) {
    console.warn('Redis del failed:', err.message);
  }
};

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
    const { points = [], distanceKm, durationSec, activityType = 'run' } = req.body || {};
    console.log(`[RUN] User ${req.userId} submitting ${activityType} with ${points.length} points, ${distanceKm}km`);
    
    // Comprehensive anti-cheat validation
    const validation = validateRunSubmission(points, activityType);
    
    if (!validation.valid) {
      console.log(`[RUN] Validation failed:`, validation.errors);
      return res.status(400).json({ 
        ok: false, 
        error: validation.errors.join('. '),
        warnings: validation.warnings,
        stats: validation.stats
      });
    }
    
    if (validation.warnings.length > 0) {
      console.log(`[RUN] Warnings detected:`, validation.warnings);
    }
    
    console.log(`[RUN] Validation passed - Max speed: ${(validation.stats.maxSpeed * 3.6).toFixed(1)} km/h, Avg accuracy: ${validation.stats.avgAccuracy?.toFixed(1)}m`);


    const line = lineString(points.map((p) => [p.lng, p.lat]));
    const computedDistance = distanceKm ?? turfLength(line, { units: 'kilometers' });
    const buffered = turfBuffer(line, BUFFER_KM, { units: 'kilometers' });

    // Determine tiles touched using accurate geometry-based detection
    const { getTilesFromGeometry } = await import('./grid.js');
    const touchedTiles = buffered?.geometry ? getTilesFromGeometry(buffered.geometry) : [];
    const tileIds = new Set(touchedTiles.length > 0 ? touchedTiles : points.map((p) => tileIdFromCoord(p.lat, p.lng)));
    console.log(`[RUN] Tiles touched (geometry-based): ${tileIds.size} tiles - ${Array.from(tileIds).slice(0, 10).join(', ')}${tileIds.size > 10 ? '...' : ''}`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const runInsert = await client.query(
        `INSERT INTO runs (user_id, geojson, distance_km, duration_sec, activity_type, validation_status, raw_points, max_speed, avg_accuracy) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          req.userId, 
          buffered, 
          computedDistance, 
          durationSec ?? null,
          activityType,
          JSON.stringify(validation),
          JSON.stringify(points),
          validation.stats.maxSpeed,
          validation.stats.avgAccuracy || null
        ]
      );
      const runId = runInsert.rows[0].id;

      // Persist tile touches for history views (even when a tile isn't captured)
      const tileIdList = Array.from(tileIds);
      if (tileIdList.length > 0) {
        const distancePerTile = computedDistance / tileIdList.length;
        await client.query(
          `INSERT INTO territory_claims (tile_id, user_id, run_id, claimed_at, distance_in_tile, activity_type)
           SELECT tile_id, $1, $3, NOW(), $4, $5
           FROM UNNEST($2::text[]) AS tile_id`,
          [req.userId, tileIdList, runId, distancePerTile, activityType]
        );
      }

      const updatedTiles = [];
      for (const tileId of tileIds) {
        const tilePoly = polygonFromTile(tileId);
        const { rows } = await client.query('SELECT * FROM territories WHERE tile_id = $1', [tileId]);
        if (rows.length === 0) {
          await client.query(
            'INSERT INTO territories (tile_id, owner_id, strength, geojson, last_claimed, activity_type, conquered_by_run_id) VALUES ($1, $2, $3, $4, NOW(), $5, $6)',
            [tileId, req.userId, 1, tilePoly, activityType, runId]
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
            await client.query('UPDATE territories SET strength = $1, last_claimed = NOW(), activity_type = $2, conquered_by_run_id = $3 WHERE tile_id = $4', [strength, activityType, runId, tileId]);
            updatedTiles.push({ tileId, ownerId: req.userId, strength, flipped: false });
          } else {
            const strength = t.strength - 1;
            if (strength <= 0) {
              await client.query(
                'UPDATE territories SET owner_id = $1, strength = 1, last_claimed = NOW(), activity_type = $2, conquered_by_run_id = $3 WHERE tile_id = $4',
                [req.userId, activityType, runId, tileId]
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

      // Update team stats if user is in a team
      const { rows: teamRows } = await client.query(
        'SELECT team_id FROM team_members WHERE user_id = $1 AND status = $2',
        [req.userId, 'active']
      );
      
      if (teamRows.length > 0) {
        const teamId = teamRows[0].team_id;
        
        // Update team_member_stats
        await client.query(
          `INSERT INTO team_member_stats (team_id, user_id, distance_contributed_km, runs_contributed, territories_contributed)
           VALUES ($1, $2, $3, 1, $4)
           ON CONFLICT (team_id, user_id) DO UPDATE SET
             distance_contributed_km = team_member_stats.distance_contributed_km + $3,
             runs_contributed = team_member_stats.runs_contributed + 1,
             territories_contributed = team_member_stats.territories_contributed + $4`,
          [teamId, req.userId, computedDistance, updatedTiles.filter(t => t.flipped).length]
        );

        // Log run completion to team feed
        const { addTeamActivity } = await import('./teamRoutes.js');
        await addTeamActivity(client, teamId, req.userId, 'run_completed', {
          distance_km: computedDistance,
          duration_sec: durationSec,
          tiles_captured: updatedTiles.filter(t => t.flipped).length
        });

        // Update any active challenges
        await client.query(
          `UPDATE team_challenges 
           SET current_value = current_value + $1,
               status = CASE 
                 WHEN (current_value + $1) >= target_value THEN 'completed'
                 ELSE status 
               END
           WHERE team_id = $2 AND status = 'active' AND type = 'distance'`,
          [computedDistance, teamId]
        );

        // Check for newly completed challenges
        const { rows: completedChallenges } = await client.query(
          `SELECT * FROM team_challenges 
           WHERE team_id = $1 AND status = 'completed' 
           AND updated_at >= NOW() - INTERVAL '5 seconds'`,
          [teamId]
        );

        for (const challenge of completedChallenges) {
          await addTeamActivity(client, teamId, req.userId, 'challenge_completed', {
            challenge_id: challenge.id,
            title: challenge.title,
            type: challenge.type
          });
        }
      }

      await client.query('COMMIT');

      // Invalidate territory caches
      await redisDel('territories:all:*');
      await redisDel(`territories:${req.userId}:*`);

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

// Batched sync endpoint for offline runs
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const { runs = [] } = req.body || {}; // Array of { points, distanceKm, durationSec, activityType, updatedTiles }
    console.log(`[SYNC] User ${req.userId} syncing ${runs.length} runs`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const syncedRuns = [];
      for (const runData of runs) {
        const { points, distanceKm, durationSec, activityType, updatedTiles } = runData;

        // Re-validate server-side (though client already validated)
        const validation = validateRunSubmission(points, activityType);
        if (!validation.valid) {
          console.log(`[SYNC] Validation failed for run:`, validation.errors);
          continue; // Skip invalid runs
        }

        const line = lineString(points.map((p) => [p.lng, p.lat]));
        const computedDistance = distanceKm ?? turfLength(line, { units: 'kilometers' });
        const buffered = turfBuffer(line, BUFFER_KM, { units: 'kilometers' });

        const { getTilesFromGeometry } = await import('./grid.js');
        const touchedTiles = buffered?.geometry ? getTilesFromGeometry(buffered.geometry) : [];
        const tileIds = new Set(touchedTiles.length > 0 ? touchedTiles : points.map((p) => tileIdFromCoord(p.lat, p.lng)));

        const runInsert = await client.query(
          `INSERT INTO runs (user_id, geojson, distance_km, duration_sec, activity_type, validation_status, raw_points, max_speed, avg_accuracy) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            req.userId, 
            buffered, 
            computedDistance, 
            durationSec ?? null,
            activityType,
            JSON.stringify(validation),
            JSON.stringify(points),
            validation.stats.maxSpeed,
            validation.stats.avgAccuracy || null
          ]
        );
        const runId = runInsert.rows[0].id;

        // Persist tile touches
        const tileIdList = Array.from(tileIds);
        if (tileIdList.length > 0) {
          const distancePerTile = computedDistance / tileIdList.length;
          await client.query(
            `INSERT INTO territory_claims (tile_id, user_id, run_id, claimed_at, distance_in_tile, activity_type)
             SELECT tile_id, $1, $3, NOW(), $4, $5
             FROM UNNEST($2::text[]) AS tile_id`,
            [req.userId, tileIdList, runId, distancePerTile, activityType]
          );
        }

        // Apply territory updates (use client's updatedTiles for efficiency, but verify)
        for (const update of updatedTiles) {
          const { tileId, ownerId, strength, flipped } = update;
          if (ownerId !== req.userId.toString()) continue; // Only allow user's own updates

          const tilePoly = polygonFromTile(tileId);
          const { rows } = await client.query('SELECT * FROM territories WHERE tile_id = $1', [tileId]);
          if (rows.length === 0) {
            await client.query(
              'INSERT INTO territories (tile_id, owner_id, strength, geojson, last_claimed, activity_type, conquered_by_run_id) VALUES ($1, $2, $3, $4, NOW(), $5, $6)',
              [tileId, req.userId, strength, tilePoly, activityType, runId]
            );
            if (flipped) {
              await client.query(
                'INSERT INTO territory_history (tile_id, from_owner, to_owner) VALUES ($1, NULL, $2)',
                [tileId, req.userId]
              );
            }
          } else {
            const t = rows[0];
            // Conflict resolution: if already owned by someone else, skip
            if (t.owner_id !== req.userId && !flipped) {
              console.log(`Conflict: Tile ${tileId} owned by ${t.owner_id}, skipping update`);
              continue;
            }
            if (t.owner_id === req.userId) {
              await client.query('UPDATE territories SET strength = $1, last_claimed = NOW(), activity_type = $2, conquered_by_run_id = $3 WHERE tile_id = $4', [strength, activityType, runId, tileId]);
            } else if (flipped) {
              await client.query(
                'UPDATE territories SET owner_id = $1, strength = $2, last_claimed = NOW(), activity_type = $3, conquered_by_run_id = $4 WHERE tile_id = $5',
                [req.userId, strength, activityType, runId, tileId]
              );
              await client.query(
                'INSERT INTO territory_history (tile_id, from_owner, to_owner) VALUES ($1, $2, $3)',
                [tileId, t.owner_id, req.userId]
              );
            } else {
              await client.query('UPDATE territories SET strength = $1, last_claimed = NOW() WHERE tile_id = $2', [strength, tileId]);
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

        syncedRuns.push({ runId, updatedTiles });
      }

      // Refresh owned counts after all runs
      const { rows: ownedRows } = await client.query('SELECT COUNT(*)::int AS c FROM territories WHERE owner_id = $1', [req.userId]);
      const owned = ownedRows[0].c || 0;
      const areaKm2 = owned * tileAreaKm2(''); // Approximate
      await client.query(
        'UPDATE user_stats SET territories_owned = $1, area_km2 = $2, updated_at = NOW() WHERE user_id = $3',
        [owned, areaKm2, req.userId]
      );

      await client.query('COMMIT');

      // Invalidate territory caches
      await redisDel('territories:all:*');
      await redisDel(`territories:${req.userId}:*`);

      return res.json({ ok: true, syncedRuns });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Sync failed:', err);
      return res.status(500).json({ ok: false, error: 'Sync failed' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

export default router;
