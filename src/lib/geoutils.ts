/**
 * Geospatial utility functions for real GPS-accurate distance calculations
 */

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in meters

  return distance;
}

/**
 * Calculate total distance for an array of GPS points
 * Returns distance in kilometers
 */
export function calculateTotalDistance(
  points: Array<{ latitude: number; longitude: number }>
): number {
  if (points.length < 2) return 0;

  let totalMeters = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    totalMeters += calculateDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );
  }

  return totalMeters / 1000; // Convert to kilometers
}

/**
 * Calculate speed between two points
 * Returns speed in m/s
 */
export function calculateSpeed(
  point1: { latitude: number; longitude: number; timestamp: number },
  point2: { latitude: number; longitude: number; timestamp: number }
): number {
  const distance = calculateDistance(
    point1.latitude,
    point1.longitude,
    point2.latitude,
    point2.longitude
  );
  
  const timeDiff = (point2.timestamp - point1.timestamp) / 1000; // seconds
  if (timeDiff <= 0) return 0;

  return distance / timeDiff; // m/s
}

/**
 * Validate if a run is legitimate based on speed
 * Max human running speed: ~10 m/s (36 km/h)
 */
export function validateRunSpeed(
  points: Array<{ latitude: number; longitude: number; timestamp: number }>,
  maxSpeedMs: number = 10
): { valid: boolean; maxSpeed: number; invalidSegments: number } {
  if (points.length < 2) {
    return { valid: true, maxSpeed: 0, invalidSegments: 0 };
  }

  let maxSpeed = 0;
  let invalidSegments = 0;

  for (let i = 1; i < points.length; i++) {
    const speed = calculateSpeed(points[i - 1], points[i]);
    if (speed > maxSpeed) maxSpeed = speed;
    if (speed > maxSpeedMs) invalidSegments++;
  }

  return {
    valid: invalidSegments === 0,
    maxSpeed,
    invalidSegments,
  };
}

/**
 * Calculate bearing (direction) between two points
 * Returns bearing in degrees (0-360)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Get bounds for a set of coordinates
 */
export function getBounds(points: Array<{ latitude: number; longitude: number }>) {
  if (points.length === 0) return null;

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);

  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

/**
 * Convert meters to a buffer distance suitable for different zoom levels
 * For territory visualization
 */
export function getTerritoryBuffer(distanceKm: number): number {
  // For every 1km run, create a 50m buffer zone (0.05km)
  // This can be adjusted based on your game mechanics
  return Math.max(0.03, distanceKm * 0.05); // minimum 30m buffer
}
