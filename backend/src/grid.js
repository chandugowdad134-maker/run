import geohash from 'ngeohash';
import { polygon, area } from '@turf/turf';

const TILE_PRECISION = 6; // ~0.6km cells

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
  // Rough estimate for precision 6 geohash ~0.36 km^2
  if (!tileId) return 0.36;
  return 0.36;
}
