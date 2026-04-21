import ngeohash from 'ngeohash';

export const encodeGeohash = (lat: number, lng: number, precision = 7): string => {
  return ngeohash.encode(lat, lng, precision);
};

declare module 'ngeohash' {
  export function encode(lat: number, lng: number, precision?: number): string;
  export function decode(hash: string): { latitude: number; longitude: number };
}

function toLatLng(p: { latitude: number; longitude: number }): { lat: number; lng: number } {
  return { lat: p.latitude, lng: p.longitude };
}

// Helper: distance between two points in km
export function distanceBetweenPoints(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371; // km
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const a_ = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a_), Math.sqrt(1-a_));
  return R * c;
}

// Distance from point to line segment (in metres)
function distanceToSegment(
  p: { lat: number; lng: number },
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371e3; // metres
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const φp = (p.lat * Math.PI) / 180;
  const λ1 = (a.longitude * Math.PI) / 180;
  const λ2 = (b.longitude * Math.PI) / 180;
  const λp = (p.lng * Math.PI) / 180;

  const δ13 = 2 * Math.asin(Math.sqrt(
    Math.sin((φp - φ1) / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φp) * Math.sin((λp - λ1) / 2) ** 2
  ));
  const θ13 = Math.atan2(
    Math.sin(λp - λ1) * Math.cos(φp),
    Math.cos(φ1) * Math.sin(φp) - Math.sin(φ1) * Math.cos(φp) * Math.cos(λp - λ1)
  );
  const θ12 = Math.atan2(
    Math.sin(λ2 - λ1) * Math.cos(φ2),
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)
  );
  const δxt = Math.asin(Math.sin(δ13) * Math.sin(θ13 - θ12));
  return Math.abs(δxt) * R;
}

// Compute minimum distance (in metres) from a point to a polyline
export const distanceToPolyline = (
  point: { lat: number; lng: number },
  polyline: { latitude: number; longitude: number }[]
): number => {
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const dist = distanceToSegment(point, a, b);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
};

// Cumulative distance along polyline up to a given segment index (in km)
function distanceAlongPolylineUpToIndex(polyline: { latitude: number; longitude: number }[], index: number): number {
  let dist = 0;
  for (let i = 0; i < index; i++) {
    const p1 = toLatLng(polyline[i]);
    const p2 = toLatLng(polyline[i + 1]);
    dist += distanceBetweenPoints(p1, p2);
  }
  return dist;
}

// Project point onto line segment (helper for snapToPolyline)
function projectPointOnLineSegment(p: { lat: number; lng: number }, a: { lat: number; lng: number }, b: { lat: number; lng: number }): { lat: number; lng: number } {
  const ab = { x: b.lng - a.lng, y: b.lat - a.lat };
  const ap = { x: p.lng - a.lng, y: p.lat - a.lat };
  const t = (ap.x * ab.x + ap.y * ab.y) / (ab.x * ab.x + ab.y * ab.y);
  const clampedT = Math.max(0, Math.min(1, t));
  return {
    lng: a.lng + ab.x * clampedT,
    lat: a.lat + ab.y * clampedT
  };
}

/**
 * Finds the closest point on a polyline to a given point,
 * and returns the point and the cumulative distance along the polyline (in km).
 */
export function snapToPolyline(
  point: { lat: number; lng: number },
  polyline: { latitude: number; longitude: number }[]
): { point: { lat: number; lng: number }; distanceKm: number } {
  let minDist = Infinity;
  let closestPoint = { lat: point.lat, lng: point.lng };
  let closestSegmentIndex = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = toLatLng(polyline[i]);
    const p2 = toLatLng(polyline[i + 1]);
    const proj = projectPointOnLineSegment(point, p1, p2);
    const dist = distanceBetweenPoints(point, proj);
    if (dist < minDist) {
      minDist = dist;
      closestPoint = proj;
      closestSegmentIndex = i;
    }
  }

  const distanceToStart = distanceAlongPolylineUpToIndex(polyline, closestSegmentIndex);
  const distanceOnSegment = distanceBetweenPoints(
    toLatLng(polyline[closestSegmentIndex]),
    closestPoint
  );
  const totalDistance = distanceToStart + distanceOnSegment;
  return { point: closestPoint, distanceKm: totalDistance };
}