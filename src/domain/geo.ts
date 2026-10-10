// Geographic helpers (pure). Distances use the haversine formula; with PostGIS enabled
// these would be replaced by ST_DWithin queries (see docs/ARCHITECTURE.md).
const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Degrees of latitude/longitude per km (approximate, adequate for bounding-box prefilters). */
export function boundingBox(center: { latitude: number; longitude: number }, radiusKm: number) {
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos((center.latitude * Math.PI) / 180) || 1);
  return {
    minLat: center.latitude - dLat,
    maxLat: center.latitude + dLat,
    minLng: center.longitude - dLng,
    maxLng: center.longitude + dLng,
  };
}

/**
 * Public coordinates are deliberately fuzzed (up to ~350 m) so that exact pickup
 * points are only revealed to parties who have a confirmed role in the handover.
 * The jitter is deterministic per donation so markers do not wander between requests.
 */
export function approximateLocation(
  point: { latitude: number; longitude: number },
  seed: string,
): { latitude: number; longitude: number } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const angle = ((h % 3600) / 3600) * 2 * Math.PI;
  const distanceKm = 0.1 + ((Math.floor(h / 3600) % 250) / 1000);
  const dLat = (distanceKm * Math.cos(angle)) / 110.574;
  const dLng = (distanceKm * Math.sin(angle)) / (111.32 * Math.cos((point.latitude * Math.PI) / 180) || 1);
  return {
    latitude: Math.round((point.latitude + dLat) * 1e5) / 1e5,
    longitude: Math.round((point.longitude + dLng) * 1e5) / 1e5,
  };
}
