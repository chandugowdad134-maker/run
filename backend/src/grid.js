import geohash from 'ngeohash';
import { polygon, area } from '@turf/turf';

const TILE_PRECISION = 7; // ~150m cells (smaller = more territories per run)

export function tileIdFromCoord(lat, lon) {
  return geohash.encode(lat, lon, TILE_PRECISION);
}

export function polygonFromTile(tileId) {
  const { minlat, maxlat, minlon, maxlon } = geohash.decode_bbox(tileId);
  // Create a closed polygon from bbox coordinates
  const coords = [
    [minlon, minlat],
    [maxlon, minlat],
    [maxlon, maxlat],
    [minlon, maxlat],
    [minlon, minlat] // Close the ring
  ];
  return polygon([coords]);
}

export function tileAreaKm2(tileId) {
  const poly = polygonFromTile(tileId);
  if (!poly) return approximateArea(tileId);
  const areaSqM = area(poly);
  return areaSqM / 1_000_000;
}

function approximateArea(tileId) {
  // Rough estimate for precision 7 geohash ~0.02 km^2 (150m x 150m)
  if (!tileId) return 0.02;
  return 0.02;
}

/**
 * Find all geohash tiles that intersect with a GeoJSON geometry (typically buffered line).
 * Uses bounding box scan + turf intersection check for accuracy.
 */
export function getTilesFromGeometry(geometry) {
  if (!geometry || !geometry.coordinates) return [];
  
  const { booleanIntersects } = require('@turf/turf');
  const geoPoly = { type: 'Feature', geometry };
  
  // Get bounding box of the geometry
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  
  const processCoords = (coords) => {
    if (Array.isArray(coords[0])) {
      coords.forEach(processCoords);
    } else {
      const [lon, lat] = coords;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  };
  processCoords(geometry.coordinates);
  
  // Generate candidate tiles from bbox (with small margin)
  const margin = 0.002; // ~200m
  const tiles = new Set();
  
  // Sample lat/lon grid with step size smaller than tile precision
  const step = 0.0015; // ~150m (matches TILE_PRECISION 7)
  for (let lat = minLat - margin; lat <= maxLat + margin; lat += step) {
    for (let lon = minLon - margin; lon <= maxLon + margin; lon += step) {
      const tileId = tileIdFromCoord(lat, lon);
      if (!tiles.has(tileId)) {
        // Check if tile actually intersects the geometry
        const tilePoly = polygonFromTile(tileId);
        if (booleanIntersects(geoPoly, tilePoly)) {
          tiles.add(tileId);
        }
      }
    }
  }
  
  return Array.from(tiles);
}
