// Populate test data for Territory Runner app
import pg from 'pg';
import bcrypt from 'bcrypt';
import geohash from 'ngeohash';
import { polygon, lineString, buffer as turfBuffer, length as turfLength } from '@turf/turf';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Test users data
const TEST_USERS = [
  { username: 'alice_runner', email: 'alice@example.com', password: 'Test123!' },
  { username: 'bob_cyclist', email: 'bob@example.com', password: 'Test123!' },
  { username: 'charlie_explorer', email: 'charlie@example.com', password: 'Test123!' }
];

// Bangalore coordinates for test runs
const BANGALORE_CENTER = { lat: 13.0827, lng: 77.5877 };
const DEVANAHALLI = { lat: 13.2443, lng: 77.7086 }; // Near Bangalore Airport

function generateRunPoints(startLat, startLng, distance, duration) {
  const points = [];
  const numPoints = Math.ceil(duration / 10); // Point every 10 seconds
  const stepLat = (distance / 111.32) / numPoints; // ~111.32 km per degree
  const stepLng = stepLat / Math.cos(startLat * Math.PI / 180);
  
  for (let i = 0; i < numPoints; i++) {
    points.push({
      lat: startLat + (i * stepLat * (0.8 + Math.random() * 0.4)),
      lng: startLng + (i * stepLng * (0.8 + Math.random() * 0.4)),
      timestamp: Date.now() - (duration * 1000) + (i * 10000),
      accuracy: 5 + Math.random() * 5
    });
  }
  
  return points;
}

function tileIdFromCoord(lat, lon) {
  return geohash.encode(lat, lon, 7);
}

function polygonFromTile(tileId) {
  const bbox = geohash.decode_bbox(tileId);
  const [minlat, minlon, maxlat, maxlon] = bbox;
  const coords = [
    [minlon, minlat],
    [maxlon, minlat],
    [maxlon, maxlat],
    [minlon, maxlat],
    [minlon, minlat]
  ];
  return polygon([coords]);
}

async function populateData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🧹 Cleaning existing test data...');
    await client.query("DELETE FROM competition_members WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')");
    await client.query("DELETE FROM competitions WHERE created_by IN (SELECT id FROM users WHERE email LIKE '%@example.com')");
    await client.query("DELETE FROM territory_claims WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')");
    await client.query("UPDATE territories SET conquered_by_run_id = NULL WHERE owner_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')");
    await client.query("DELETE FROM runs WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')");
    await client.query("DELETE FROM territory_history WHERE from_owner IN (SELECT id FROM users WHERE email LIKE '%@example.com') OR to_owner IN (SELECT id FROM users WHERE email LIKE '%@example.com')");
    await client.query("DELETE FROM territories WHERE owner_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')");
    await client.query("DELETE FROM user_stats WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')");
    await client.query("DELETE FROM friendships WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com') OR friend_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')");
    await client.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')");
    await client.query("DELETE FROM users WHERE email LIKE '%@example.com'");
    
    // Create test users
    console.log('\n👥 Creating test users...');
    const userIds = [];
    
    for (const user of TEST_USERS) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const { rows } = await client.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        [user.username, user.email, hashedPassword]
      );
      userIds.push(rows[0].id);
      console.log(`  ✓ ${user.username} (ID: ${rows[0].id})`);
      
      // Initialize user stats
      await client.query(
        'INSERT INTO user_stats (user_id, total_distance_km, total_runs, territories_owned) VALUES ($1, 0, 0, 0) ON CONFLICT (user_id) DO NOTHING',
        [rows[0].id]
      );
    }
    
    // Create friendships
    console.log('\n🤝 Creating friendships...');
    await client.query(
      'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3), ($2, $1, $3)',
      [userIds[0], userIds[1], 'accepted']
    );
    console.log(`  ✓ ${TEST_USERS[0].username} ↔ ${TEST_USERS[1].username}`);
    
    // Create runs and territories
    console.log('\n🏃 Creating runs and territories...');
    
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const numRuns = 2 + Math.floor(Math.random() * 3);
      
      // Alternate between Bangalore center and Devanahalli
      const useDevanahalli = i === 1; // Bob runs near Devanahalli
      const baseLocation = useDevanahalli ? DEVANAHALLI : BANGALORE_CENTER;
      
      for (let j = 0; j < numRuns; j++) {
        const distance = 0.5 + Math.random() * 2; // 0.5-2.5 km
        const duration = Math.floor(distance * 300); // ~5 min/km pace
        const startLat = baseLocation.lat + (Math.random() - 0.5) * 0.05;
        const startLng = baseLocation.lng + (Math.random() - 0.5) * 0.05;
        
        const points = generateRunPoints(startLat, startLng, distance, duration);
        const line = lineString(points.map(p => [p.lng, p.lat]));
        const buffered = turfBuffer(line, 0.05, { units: 'kilometers' });
        
        // Insert run
        const { rows: runRows } = await client.query(
          `INSERT INTO runs (user_id, geojson, distance_km, duration_sec, activity_type, validation_status, raw_points, max_speed, avg_accuracy) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            userId,
            buffered,
            distance,
            duration,
            'run',
            JSON.stringify({ valid: true }),
            JSON.stringify(points),
            3.5,
            7.5
          ]
        );
        const runId = runRows[0].id;
        
        // Get tiles from run
        const tiles = new Set();
        points.forEach(p => tiles.add(tileIdFromCoord(p.lat, p.lng)));
        
        // Create territories
        for (const tileId of tiles) {
          const { rows: existingTiles } = await client.query(
            'SELECT * FROM territories WHERE tile_id = $1',
            [tileId]
          );
          
          if (existingTiles.length === 0) {
            const tilePoly = polygonFromTile(tileId);
            await client.query(
              'INSERT INTO territories (tile_id, owner_id, strength, geojson, last_claimed, activity_type, conquered_by_run_id) VALUES ($1, $2, $3, $4, NOW(), $5, $6)',
              [tileId, userId, 1, tilePoly, 'run', runId]
            );
            
            await client.query(
              'INSERT INTO territory_history (tile_id, from_owner, to_owner) VALUES ($1, NULL, $2)',
              [tileId, userId]
            );
          } else {
            const existing = existingTiles[0];
            if (existing.owner_id !== userId) {
              await client.query(
                'UPDATE territories SET owner_id = $1, strength = 1, last_claimed = NOW(), conquered_by_run_id = $2 WHERE tile_id = $3',
                [userId, runId, tileId]
              );
              
              await client.query(
                'INSERT INTO territory_history (tile_id, from_owner, to_owner) VALUES ($1, $2, $3)',
                [tileId, existing.owner_id, userId]
              );
            }
          }
          
          await client.query(
            'INSERT INTO territory_claims (tile_id, user_id, run_id, claimed_at, distance_in_tile, activity_type) VALUES ($1, $2, $3, NOW(), $4, $5)',
            [tileId, userId, runId, distance / tiles.size, 'run']
          );
        }
        
        // Update user stats
        await client.query(
          'UPDATE user_stats SET total_distance_km = total_distance_km + $1, total_runs = total_runs + 1 WHERE user_id = $2',
          [distance, userId]
        );
        
        console.log(`  ✓ ${TEST_USERS[i].username}: ${distance.toFixed(2)}km run, ${tiles.size} tiles`);
      }
    }
    
    // Update territory counts
    console.log('\n📊 Updating territory counts...');
    for (const userId of userIds) {
      const { rows } = await client.query(
        'SELECT COUNT(*) FROM territories WHERE owner_id = $1',
        [userId]
      );
      await client.query(
        'UPDATE user_stats SET territories_owned = $1 WHERE user_id = $2',
        [parseInt(rows[0].count), userId]
      );
    }
    
    // Create a competition
    console.log('\n🏆 Creating competition...');
    const { rows: compRows } = await client.query(
      `INSERT INTO competitions (name, visibility, scoring, is_team_based, starts_at, ends_at, created_by) 
       VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '7 days', $5) RETURNING id`,
      [
        'Weekly Distance Challenge',
        'public',
        'distance',
        false,
        userIds[0]
      ]
    );
    const compId = compRows[0].id;
    
    // Add members
    for (const userId of userIds) {
      await client.query(
        'INSERT INTO competition_members (competition_id, user_id) VALUES ($1, $2)',
        [compId, userId]
      );
    }
    console.log('  ✓ Weekly Distance Challenge created');
    
    await client.query('COMMIT');
    
    console.log('\n✅ Test data populated successfully!');
    console.log('\n📋 Summary:');
    console.log(`  Users: ${userIds.length}`);
    
    for (let i = 0; i < userIds.length; i++) {
      const { rows: stats } = await client.query(
        'SELECT * FROM user_stats WHERE user_id = $1',
        [userIds[i]]
      );
      console.log(`  ${TEST_USERS[i].username}: ${stats[0].total_runs} runs, ${parseFloat(stats[0].total_distance_km).toFixed(2)}km, ${stats[0].territories_owned} territories`);
    }
    
    console.log('\n🔑 Login credentials (all users):');
    console.log('  Password: Test123!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

populateData().catch(console.error);
