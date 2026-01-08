import { lineString, buffer as turfBuffer, polygon, area, booleanIntersects } from '@turf/turf';
import geohash from 'ngeohash';

const TILE_PRECISION = 7;
const BUFFER_KM = 0.05;

// Activity type speed limits (m/s)
const SPEED_LIMITS = {
  run: {
    min: 0.56,  // 2 km/h
    max: 5.56,  // 20 km/h
  },
  cycle: {
    min: 2.78,  // 10 km/h
    max: 11.11, // 40 km/h
  }
};

const VEHICLE_SPEED_THRESHOLD = 6.94; // 25 km/h
const GPS_JUMP_THRESHOLD = 100; // 100m
const MIN_ACCURACY = 50; // meters
const ACCELERATION_THRESHOLD = 5; // m/s²
const MIN_TERRITORY_TIME = 180; // 3 minutes

export interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: any;
}

export function validateRunSubmission(points: GPSPoint[], activityType: string = 'run'): ValidationResult {
  const validation: ValidationResult = {
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

  if (!['run', 'cycle'].includes(activityType)) {
    validation.valid = false;
    validation.errors.push('Invalid activity type');
    return validation;
  }

  const limits = SPEED_LIMITS[activityType as keyof typeof SPEED_LIMITS];

  // Speed analysis
  const speedAnalysis = analyzeSpeed(points, limits);
  validation.stats = { ...validation.stats, ...speedAnalysis };

  if (speedAnalysis.vehicleSegments > 0) {
    validation.valid = false;
    validation.errors.push(`Vehicle-like speed detected: ${(speedAnalysis.maxSpeed * 3.6).toFixed(1)} km/h`);
  }

  // Acceleration
  const accelAnalysis = analyzeAcceleration(points);
  validation.stats = { ...validation.stats, ...accelAnalysis };

  if (accelAnalysis.suspiciousCount > 3) {
    validation.warnings.push('Unusual acceleration patterns detected');
  }

  // GPS quality
  const gpsQuality = analyzeGPSQuality(points);
  validation.stats = { ...validation.stats, ...gpsQuality };

  if (gpsQuality.jumps > 5) {
    validation.valid = false;
    validation.errors.push('Too many GPS jumps detected');
  }

  if (gpsQuality.avgAccuracy > MIN_ACCURACY) {
    validation.warnings.push(`Low GPS accuracy: ${gpsQuality.avgAccuracy.toFixed(0)}m`);
  }

  // Territory
  const territoryCheck = validateTerritoryCapture(points);
  validation.stats = { ...validation.stats, ...territoryCheck };

  if (!territoryCheck.valid) {
    validation.warnings.push('Insufficient time in territory for capture');
  }

  return validation;
}

function analyzeSpeed(points: GPSPoint[], limits: any) {
  let maxSpeed = 0;
  let totalSpeed = 0;
  let speedCount = 0;
  let vehicleSegments = 0;
  let consecutiveHighSpeed = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];

    const dt = (b.timestamp - a.timestamp) / 1000;
    if (dt <= 0) continue;

    const distance = haversine(a, b);
    const speed = distance / dt;

    maxSpeed = Math.max(maxSpeed, speed);
    totalSpeed += speed;
    speedCount++;

    if (speed > VEHICLE_SPEED_THRESHOLD) {
      consecutiveHighSpeed++;
      if (consecutiveHighSpeed > 5) {
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

function analyzeAcceleration(points: GPSPoint[]) {
  let maxAccel = 0;
  let suspiciousCount = 0;
  let prevSpeed = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];

    const dt = (b.timestamp - a.timestamp) / 1000;
    if (dt <= 0 || dt > 10) continue;

    const distance = haversine(a, b);
    const speed = distance / dt;

    if (prevSpeed > 0) {
      const accel = Math.abs(speed - prevSpeed) / dt;
      maxAccel = Math.max(maxAccel, accel);

      if (accel > ACCELERATION_THRESHOLD && dt < 3) {
        suspiciousCount++;
      }
    }

    prevSpeed = speed;
  }

  return { maxAccel, suspiciousCount };
}

function analyzeGPSQuality(points: GPSPoint[]) {
  let jumps = 0;
  let totalAccuracy = 0;
  let accuracyCount = 0;
  let straightSegments = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];

    const dt = (b.timestamp - a.timestamp) / 1000;
    if (dt > 0 && dt < 5) {
      const distance = haversine(a, b);
      if (distance > GPS_JUMP_THRESHOLD) {
        jumps++;
      }
    }

    if (b.accuracy !== undefined) {
      totalAccuracy += b.accuracy;
      accuracyCount++;
    }

    if (i >= 2) {
      const c = points[i];
      const angle = calculateAngleDeviation(points[i - 2], points[i - 1], c);
      if (Math.abs(angle) < 5) {
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

function validateTerritoryCapture(points: GPSPoint[]) {
  if (points.length < 2) {
    return { valid: false, validTime: 0, stationaryTime: 0 };
  }

  let totalTime = 0;
  let stationaryTime = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];

    const dt = (b.timestamp - a.timestamp) / 1000;
    totalTime += dt;

    const distance = haversine(a, b);
    if (distance < 5 && dt > 0) {
      stationaryTime += dt;
    }
  }

  return {
    valid: totalTime >= MIN_TERRITORY_TIME,
    validTime: totalTime,
    stationaryTime
  };
}

function haversine(a: GPSPoint, b: GPSPoint): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
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

function calculateAngleDeviation(a: GPSPoint, b: GPSPoint, c: GPSPoint): number {
  const bearing1 = Math.atan2(
    Math.sin(c.lng - b.lng) * Math.cos(c.lat),
    Math.cos(b.lat) * Math.sin(c.lat) - Math.sin(b.lat) * Math.cos(c.lat) * Math.cos(c.lng - b.lng)
  );

  const bearing2 = Math.atan2(
    Math.sin(b.lng - a.lng) * Math.cos(b.lat),
    Math.cos(a.lat) * Math.sin(b.lat) - Math.sin(a.lat) * Math.cos(b.lat) * Math.cos(b.lng - a.lng)
  );

  let angle = (bearing1 - bearing2) * 180 / Math.PI;

  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;

  return angle;
}

// Grid functions
export function tileIdFromCoord(lat: number, lon: number): string {
  return geohash.encode(lat, lon, TILE_PRECISION);
}

export function polygonFromTile(tileId: string) {
  const { minlat, maxlat, minlon, maxlon } = geohash.decode_bbox(tileId);
  const coords = [
    [minlon, minlat],
    [maxlon, minlat],
    [maxlon, maxlat],
    [minlon, maxlat],
    [minlon, minlat]
  ];
  return polygon([coords]);
}

export function getTilesFromGeometry(geometry: any): string[] {
  if (!geometry || !geometry.coordinates) return [];

  const geoPoly = { type: 'Feature', geometry };

  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;

  const processCoords = (coords: any) => {
    if (Array.isArray(coords[0])) {
      coords.forEach(processCoords);
    } else {
      const [lon, lat] = coords;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
    }
  };
  processCoords(geometry.coordinates);

  const margin = 0.002;
  const tiles = new Set<string>();

  const step = 0.0015;
  for (let lat = minLat - margin; lat <= maxLat + margin; lat += step) {
    for (let lon = minLon - margin; lon <= maxLon + margin; lon += step) {
      const tileId = tileIdFromCoord(lat, lon);
      if (!tiles.has(tileId)) {
        const tilePoly = polygonFromTile(tileId);
        if (booleanIntersects(geoPoly, tilePoly)) {
          tiles.add(tileId);
        }
      }
    }
  }

  return Array.from(tiles);
}

// Territory acquisition
export interface TerritoryUpdate {
  tileId: string;
  ownerId: string;
  strength: number;
  flipped: boolean;
}

export function calculateTerritoryAcquisition(
  points: GPSPoint[],
  userId: string,
  localTerritories: Map<string, { ownerId: string; strength: number }>
): { touchedTiles: string[]; updatedTiles: TerritoryUpdate[]; bufferedPath: any } {
  // Create line and buffer
  const line = lineString(points.map(p => [p.lng, p.lat]));
  const buffered = turfBuffer(line, BUFFER_KM, { units: 'kilometers' });

  // Get touched tiles
  const touchedTiles = buffered?.geometry ? getTilesFromGeometry(buffered.geometry) : 
    points.map(p => tileIdFromCoord(p.lat, p.lng));

  const updatedTiles: TerritoryUpdate[] = [];

  for (const tileId of touchedTiles) {
    const existing = localTerritories.get(tileId);
    if (!existing) {
      // New territory
      localTerritories.set(tileId, { ownerId: userId, strength: 1 });
      updatedTiles.push({ tileId, ownerId: userId, strength: 1, flipped: true });
    } else if (existing.ownerId === userId) {
      // Strengthen
      existing.strength += 1;
      updatedTiles.push({ tileId, ownerId: userId, strength: existing.strength, flipped: false });
    } else {
      // Contest
      existing.strength -= 1;
      if (existing.strength <= 0) {
        existing.ownerId = userId;
        existing.strength = 1;
        updatedTiles.push({ tileId, ownerId: userId, strength: 1, flipped: true });
      } else {
        updatedTiles.push({ tileId, ownerId: existing.ownerId, strength: existing.strength, flipped: false });
      }
    }
  }

  return { touchedTiles, updatedTiles, bufferedPath: buffered };
}