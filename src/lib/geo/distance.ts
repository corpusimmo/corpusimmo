/**
 * Spherical geometry helpers.
 *
 * Everything here uses the WGS84 mean earth radius on a sphere. Over the
 * distances this product cares about (0 → 20 km) the spherical error against
 * the true ellipsoid stays under 0.5 %, which is far below the noise already
 * present in DVF coordinates (parcel centroid, not building entrance).
 */

import type { BBox, LatLng } from "@/types/geo";

/** IUGG mean radius, metres. */
const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Great-circle distance between two points, in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Smallest axis-aligned box that FULLY CONTAINS the disc of `radiusMeters`
 * around `center`.
 *
 * The containment guarantee is what makes the DVF radius query correct: we
 * fetch by box, then filter by exact distance. A box that under-covers the
 * disc would silently drop sales on the diagonals — the naive
 * `radius / (R · cos(lat))` does exactly that, because the easternmost point of
 * the circle is not the one due east but the one tangent to a meridian, which
 * sits at a higher latitude where a degree of longitude is shorter.
 *
 * The exact half-width is `asin(sin(r) / cos(lat))`.
 */
export function bboxAround(center: LatLng, radiusMeters: number): BBox {
  const radius = Math.max(0, radiusMeters);
  if (radius === 0) return [center.lng, center.lat, center.lng, center.lat];

  const angular = radius / EARTH_RADIUS_M;
  const latDelta = toDeg(angular);
  const cos = Math.cos(toRad(center.lat));

  // Disc reaching over a pole: no longitude bound is meaningful any more.
  const ratio = Math.abs(cos) < 1e-12 ? 2 : Math.sin(angular) / cos;
  const lngDelta = ratio >= 1 ? 180 : toDeg(Math.asin(ratio));

  // ~0,1 mm of padding. Trigonometry round-trips land a few ULPs short of the
  // edge, and an inclusive test on the exact boundary would flip at random.
  const pad = 1e-9;

  return [
    clampLng(center.lng - lngDelta - pad),
    clampLat(center.lat - latDelta - pad),
    clampLng(center.lng + lngDelta + pad),
    clampLat(center.lat + latDelta + pad),
  ];
}

export function bboxContains(bbox: BBox, p: LatLng): boolean {
  const [west, south, east, north] = bbox;
  return p.lng >= west && p.lng <= east && p.lat >= south && p.lat <= north;
}

/** Approximate area of the box in km², using the mid-latitude for longitude. */
export function bboxArea(bbox: BBox): number {
  const [west, south, east, north] = bbox;
  const midLat = (south + north) / 2;
  const heightKm = (toRad(north - south) * EARTH_RADIUS_M) / 1000;
  const widthKm = (toRad(east - west) * EARTH_RADIUS_M * Math.cos(toRad(midLat))) / 1000;
  return Math.abs(heightKm * widthKm);
}

export function bboxCenter(bbox: BBox): LatLng {
  const [west, south, east, north] = bbox;
  return { lat: (south + north) / 2, lng: (west + east) / 2 };
}

/** Longest side of the box, in metres — used to size the commune sampling grid. */
export function bboxMaxSpanMeters(bbox: BBox): number {
  const [west, south, east, north] = bbox;
  const midLat = (south + north) / 2;
  const height = haversineMeters({ lat: south, lng: west }, { lat: north, lng: west });
  const width = haversineMeters({ lat: midLat, lng: west }, { lat: midLat, lng: east });
  return Math.max(height, width);
}

/** Grow (or shrink, with a negative value) a box by a metric margin. */
export function bboxExpand(bbox: BBox, meters: number): BBox {
  const center = bboxCenter(bbox);
  const latDelta = toDeg(meters / EARTH_RADIUS_M);
  const cos = Math.max(Math.cos(toRad(center.lat)), 1e-9);
  const lngDelta = toDeg(meters / (EARTH_RADIUS_M * cos));
  const [west, south, east, north] = bbox;
  return [
    clampLng(west - lngDelta),
    clampLat(south - latDelta),
    clampLng(east + lngDelta),
    clampLat(north + latDelta),
  ];
}

export function bboxIntersects(a: BBox, b: BBox): boolean {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
}

/** Point reached by travelling `distanceMeters` on `bearingDeg` from `origin`. */
export function destinationPoint(origin: LatLng, distanceMeters: number, bearingDeg: number): LatLng {
  const angular = distanceMeters / EARTH_RADIUS_M;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);

  const sinLat2 =
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing);
  const lat2 = Math.asin(Math.min(1, Math.max(-1, sinLat2)));
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * sinLat2,
    );

  return { lat: toDeg(lat2), lng: clampLng(((toDeg(lng2) + 540) % 360) - 180) };
}

/**
 * Closed ring approximating the geodesic circle of `radiusMeters` around
 * `center`, as GeoJSON `[lng, lat]` positions.
 *
 * MapLibre has no "circle in metres" fill primitive: a `circle` layer is sized
 * in pixels and would grow/shrink with zoom, which lies about the search area.
 * Drawing the polygon ourselves keeps the radius honest at every zoom level.
 */
export function geodesicCircleRing(
  center: LatLng,
  radiusMeters: number,
  steps = 96,
): [number, number][] {
  const points: [number, number][] = [];
  const n = Math.max(12, Math.round(steps));
  for (let i = 0; i < n; i += 1) {
    const p = destinationPoint(center, radiusMeters, (i * 360) / n);
    points.push([p.lng, p.lat]);
  }
  const first = points[0];
  if (first) points.push(first);
  return points;
}

function clampLat(lat: number): number {
  return Math.min(90, Math.max(-90, lat));
}

function clampLng(lng: number): number {
  return Math.min(180, Math.max(-180, lng));
}
