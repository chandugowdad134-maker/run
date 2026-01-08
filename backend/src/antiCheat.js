// Anti-cheat validation utilities for run submission

// Activity type speed limits (m/s)
// NOTE: Walking and running are treated the same (user choice for UI only)
const SPEED_LIMITS = {
  run: {
    min: 0.56,  // 2 km/h - minimum movement speed
    max: 5.56,  // 20 km/h - maximum human running speed
    name: 'Running/Walking'
  },
  cycle: {
    min: 2.78,  // 10 km/h - minimum cycling speed
    max: 11.11, // 40 km/h - maximum reasonable cycling speed
    name: 'Cycling'
  }
};

const VEHICLE_SPEED_THRESHOLD = 6.94; // 25 km/h in m/s
const GPS_JUMP_THRESHOLD = 100; // 100m instant jump is suspicious
const MIN_ACCURACY = 50; // GPS accuracy threshold in meters
const ACCELERATION_THRESHOLD = 5; // m/s² - max human acceleration
const MIN_TERRITORY_TIME = 180; // 3 minutes minimum in territory

/**
 * Validate run based on activity type and anti-cheat rules
 */
export function validateRunSubmission(points, activityType = 'run') {
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {}
  };

  if (!Array.isArray(points) || points.length < 2) {
    validation.valid = false;
    validation.errors.push('At least two GPS points required');
    return validation;
  }

  // Validate activity type
  if (!['run', 'cycle'].includes(activityType)) {
    validation.valid = false;
    validation.errors.push('Invalid activity type. Must be: run or cycle');
    return validation;
  }

  const limits = SPEED_LIMITS[activityType];
  
  // 1. Speed-based validation
  const speedAnalysis = analyzeSpeed(points, limits);
  validation.stats.maxSpeed = speedAnalysis.maxSpeed;
  validation.stats.avgSpeed = speedAnalysis.avgSpeed;
  validation.stats.vehicleSegments = speedAnalysis.vehicleSegments;
  
  if (speedAnalysis.vehicleSegments > 0) {
    validation.valid = false;
    validation.errors.push(
      `Vehicle-like speed detected: ${(speedAnalysis.maxSpeed * 3.6).toFixed(1)} km/h (limit: ${(limits.max * 3.6).toFixed(1)} km/h)`
    );
  }

  // 2. Acceleration pattern detection
  const accelAnalysis = analyzeAcceleration(points);
  validation.stats.maxAcceleration = accelAnalysis.maxAccel;
  validation.stats.suspiciousAccel = accelAnalysis.suspiciousCount;
  
  if (accelAnalysis.suspiciousCount > 3) {
    validation.warnings.push('Unusual acceleration patterns detected');
  }

  // 3. GPS quality check
  const gpsQuality = analyzeGPSQuality(points);
  validation.stats.jumps = gpsQuality.jumps;
  validation.stats.straightness = gpsQuality.straightness;
  validation.stats.avgAccuracy = gpsQuality.avgAccuracy;
  
  if (gpsQuality.jumps > 5) {
    validation.valid = false;
    validation.errors.push('Too many GPS jumps detected - possible fake GPS');
  }

  if (gpsQuality.avgAccuracy > MIN_ACCURACY) {
    validation.warnings.push(`Low GPS accuracy: ${gpsQuality.avgAccuracy.toFixed(0)}m`);
  }

  // 4. Territory capture validation
  const territoryCheck = validateTerritoryCapture(points);
  validation.stats.validTerritoryTime = territoryCheck.validTime;
  validation.stats.stationaryTime = territoryCheck.stationaryTime;
  
  if (!territoryCheck.valid) {
    validation.warnings.push('Insufficient time in territory for capture');
  }

  return validation;
}

/**
 * Analyze speed patterns throughout the run
 */
function analyzeSpeed(points, limits) {
  let maxSpeed = 0;
  let totalSpeed = 0;
  let speedCount = 0;
  let vehicleSegments = 0;
  let consecutiveHighSpeed = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    
    const dt = (b.timestamp && a.timestamp) ? (b.timestamp - a.timestamp) / 1000 : null;
    if (!dt || dt <= 0) continue;

    const distance = haversine(a, b);
    const speed = distance / dt; // m/s

    maxSpeed = Math.max(maxSpeed, speed);
    totalSpeed += speed;
    speedCount++;

    // Check for vehicle speed (>25 km/h for more than 5 seconds)
    if (speed > VEHICLE_SPEED_THRESHOLD) {
      consecutiveHighSpeed++;
      if (consecutiveHighSpeed > 5) { // 5+ consecutive high speed segments
        vehicleSegments++;
      }
    } else {
      consecutiveHighSpeed = 0;
    }
  }

  return {
    maxSpeed,
    avgSpeed: speedCount > 0 ? totalSpeed / speedCount : 0,
    vehicleSegments
  };
}

/**
 * Detect sudden acceleration patterns (bikes/cars accelerate fast)
 */
function analyzeAcceleration(points) {
  let maxAccel = 0;
  let suspiciousCount = 0;
  let prevSpeed = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    
    const dt = (b.timestamp && a.timestamp) ? (b.timestamp - a.timestamp) / 1000 : null;
    if (!dt || dt <= 0 || dt > 10) continue; // Skip long gaps

    const distance = haversine(a, b);
    const speed = distance / dt;

    if (prevSpeed > 0) {
      const accel = Math.abs(speed - prevSpeed) / dt;
      maxAccel = Math.max(maxAccel, accel);

      // Sudden acceleration: 0 → 30 km/h in 2-3 sec = suspicious
      if (accel > ACCELERATION_THRESHOLD && dt < 3) {
        suspiciousCount++;
      }
    }

    prevSpeed = speed;
  }

  return {
    maxAccel,
    suspiciousCount
  };
}

/**
 * Check GPS signal quality and detect fake GPS patterns
 */
function analyzeGPSQuality(points) {
  let jumps = 0;
  let totalAccuracy = 0;
  let accuracyCount = 0;
  let straightSegments = 0;
  let totalAngleVariation = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];

    // Check for GPS jumps (teleportation)
    const dt = (b.timestamp && a.timestamp) ? (b.timestamp - a.timestamp) / 1000 : null;
    if (dt && dt > 0 && dt < 5) { // Within 5 seconds
      const distance = haversine(a, b);
      if (distance > GPS_JUMP_THRESHOLD) {
        jumps++;
      }
    }

    // Track GPS accuracy if available
    if (b.accuracy !== undefined) {
      totalAccuracy += b.accuracy;
      accuracyCount++;
    }

    // Check for unrealistic straight paths (3+ points in perfect line)
    if (i >= 2) {
      const c = points[i];
      const angle = calculateAngleDeviation(points[i - 2], points[i - 1], c);
      totalAngleVariation += Math.abs(angle);
      
      if (Math.abs(angle) < 5) { // Less than 5 degrees deviation
        straightSegments++;
      }
    }
  }

  return {
    jumps,
    avgAccuracy: accuracyCount > 0 ? totalAccuracy / accuracyCount : 0,
    straightness: straightSegments / Math.max(1, points.length - 2)
  };
}

/**
 * Validate territory capture fairness (minimum time and distance in zone)
 */
function validateTerritoryCapture(points) {
  if (points.length < 2) {
    return { valid: false, validTime: 0, stationaryTime: 0 };
  }

  let totalTime = 0;
  let stationaryTime = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    
    const dt = (b.timestamp && a.timestamp) ? (b.timestamp - a.timestamp) / 1000 : 0;
    totalTime += dt;

    const distance = haversine(a, b);
    if (distance < 5 && dt > 0) { // Less than 5m movement
      stationaryTime += dt;
    }
  }

  return {
    valid: totalTime >= MIN_TERRITORY_TIME,
    validTime: totalTime,
    stationaryTime
  };
}

/**
 * Haversine distance formula (meters)
 */
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

/**
 * Calculate angle deviation between three points
 */
function calculateAngleDeviation(a, b, c) {
  const bearing1 = Math.atan2(
    Math.sin(c.lng - b.lng) * Math.cos(c.lat),
    Math.cos(b.lat) * Math.sin(c.lat) - Math.sin(b.lat) * Math.cos(c.lat) * Math.cos(c.lng - b.lng)
  );
  
  const bearing2 = Math.atan2(
    Math.sin(b.lng - a.lng) * Math.cos(b.lat),
    Math.cos(a.lat) * Math.sin(b.lat) - Math.sin(a.lat) * Math.cos(b.lat) * Math.cos(b.lng - a.lng)
  );
  
  let angle = (bearing1 - bearing2) * 180 / Math.PI;
  
  // Normalize to -180 to 180
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  
  return angle;
}
