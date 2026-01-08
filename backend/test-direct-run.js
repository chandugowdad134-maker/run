// Direct test of POST /runs endpoint with comprehensive logging

import fetch from 'node-fetch';

const API_URL = 'https://territory-runner-api.onrender.com';

// Create realistic 1km run over 5 minutes
function generateRealisticRun() {
  const startLat = 13.1896;
  const startLng = 77.7547;
  const startTime = Date.now();
  const points = [];
  
  // 5-minute run, 1 point every 10 seconds = 30 points
  // Speed: ~3.3 m/s = ~12 km/h (realistic running pace, well above 2km/h minimum)
  // Need ~33m per segment to achieve this speed
  for (let i = 0; i < 30; i++) {
    const segmentDistance = 0.0003; // ~33m in degrees
    const lat = startLat + (i * segmentDistance * 0.7); // Move northeast
    const lng = startLng + (i * segmentDistance * 0.7);
    const timestamp = startTime + (i * 10000); // 10 sec intervals
    const accuracy = 5 + Math.random() * 5; // 5-10m accuracy
    
    points.push({ lat, lng, timestamp, accuracy });
  }
  
  return {
    points,
    distanceKm: 1.0,
    durationSec: 300,
    activityType: 'run'
  };
}

async function testRun() {
  console.log('🔐 Creating test user...');
  const registerRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `testrunner${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      password: 'TestPass123!'
    })
  });
  
  const registerData = await registerRes.json();
  if (!registerData.ok) {
    console.error('❌ Registration failed:', registerData);
    return;
  }
  
  console.log('✅ User created:', registerData.userId);
  const token = registerData.token;
  
  console.log('\n🏃 Generating realistic 1km run (30 points, 5 minutes)...');
  const runData = generateRealisticRun();
  console.log('  Points:', runData.points.length);
  console.log('  Distance:', runData.distanceKm, 'km');
  console.log('  Duration:', runData.durationSec, 'sec');
  console.log('  First point:', runData.points[0]);
  console.log('  Last point:', runData.points[runData.points.length - 1]);
  
  // Calculate expected speeds
  const p1 = runData.points[0];
  const p2 = runData.points[1];
  const dt = (p2.timestamp - p1.timestamp) / 1000;
  const dLat = (p2.lat - p1.lat) * 111320; // ~111.32km per degree
  const dLng = (p2.lng - p1.lng) * 111320 * Math.cos(p1.lat * Math.PI / 180);
  const segmentDist = Math.sqrt(dLat * dLat + dLng * dLng);
  const segmentSpeed = segmentDist / dt;
  console.log(`  Segment speed: ${segmentSpeed.toFixed(2)} m/s (${(segmentSpeed * 3.6).toFixed(1)} km/h)`);
  
  console.log('\n📤 Submitting run to /runs...');
  const runRes = await fetch(`${API_URL}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(runData)
  });
  
  const runResult = await runRes.json();
  console.log('Response status:', runRes.status);
  console.log('Response body:', JSON.stringify(runResult, null, 2));
  
  if (runResult.ok) {
    console.log('✅ Run submitted successfully! Run ID:', runResult.runId);
    
    // Verify it appears in /runs list
    console.log('\n📋 Fetching user runs...');
    const listRes = await fetch(`${API_URL}/runs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const listData = await listRes.json();
    console.log('Runs in list:', listData.runs?.length || 0);
  } else {
    console.log('❌ Run submission failed:', runResult.error);
  }
}

testRun().catch(console.error);
