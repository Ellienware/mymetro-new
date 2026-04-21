// utils/geofence.ts
export interface Point {
  lat: number;
  lng: number;
}

export function calculateDistance(point1: Point, point2: Point): number {
  const R = 6371000; // meters
  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(point1.lat)) *
      Math.cos(toRadians(point2.lat)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isPointInCircle(point: Point, center: Point, radiusMeters: number): boolean {
  return calculateDistance(point, center) <= radiusMeters;
}

export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const x = point.lng;
  const y = point.lat;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInGeofence(point: Point, geofence: any): boolean {
  // geofence = { coordinates: Point[], radius?: number }
  if (geofence.radius && geofence.coordinates.length === 1) {
    return isPointInCircle(point, geofence.coordinates[0], geofence.radius);
  }
  return isPointInPolygon(point, geofence.coordinates);
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}