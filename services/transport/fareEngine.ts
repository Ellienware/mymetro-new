// services/transport/fareEngine.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure fare-calculation utilities.  No side effects, no I/O.
// All functions are exported so individual provider classes can compose them.
// ─────────────────────────────────────────────────────────────────────────────
import { FareResult, TransportStop } from './types';

// ─── Haversine distance ───────────────────────────────────────────────────────
// FIX: renamed from haversineKm (was misleading — it already returned km)
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Peak detection ───────────────────────────────────────────────────────────
export function isPeakHour(time: Date = new Date()): boolean {
  const h = time.getHours();
  return (h >= 6 && h < 9) || (h >= 15 && h < 18);
}

// ─── Distance-bracket fare ────────────────────────────────────────────────────
export interface DistanceBracket {
  maxKm:   number;
  peak:    number;
  offPeak: number;
}

export function distanceFare(
  origin:      TransportStop,
  destination: TransportStop,
  brackets:    DistanceBracket[],
  isPeak:      boolean,
): FareResult {
  // Guard: stops without valid coordinates fall back to first bracket
  if (!origin.lat || !origin.lon || !destination.lat || !destination.lon) {
    const fallback = brackets[0];
    const amount = isPeak ? fallback.peak : fallback.offPeak;
    return { amount, currency: 'ZAR', strategy: 'distance', breakdown: `R${amount.toFixed(2)} (flat fallback)` };
  }
  const km      = haversineKm(origin.lat, origin.lon, destination.lat, destination.lon);
  const sorted  = [...brackets].sort((a, b) => a.maxKm - b.maxKm);
  const bracket = sorted.find(b => km <= b.maxKm) ?? sorted[sorted.length - 1];
  const amount  = isPeak ? bracket.peak : bracket.offPeak;
  return {
    amount,
    currency:  'ZAR',
    strategy:  'distance',
    breakdown: `R${amount.toFixed(2)} (${km.toFixed(1)} km, ${isPeak ? 'peak' : 'off-peak'})`,
  };
}

// ─── Zone-based fare ──────────────────────────────────────────────────────────
export interface ZoneFareMatrix {
  [fromZone: string]: { [toZone: string]: number };
}

export function zoneFare(
  origin:      TransportStop,
  destination: TransportStop,
  matrix:      ZoneFareMatrix,
  defaultFare: number,
): FareResult {
  const fromZone = origin.zoneId ?? 'unknown';
  const toZone   = destination.zoneId ?? 'unknown';
  const amount   = matrix[fromZone]?.[toZone] ?? matrix[toZone]?.[fromZone] ?? defaultFare;
  return {
    amount,
    currency:  'ZAR',
    strategy:  'zone',
    breakdown: `R${amount.toFixed(2)} (Zone ${fromZone} → Zone ${toZone})`,
  };
}

// ─── Flat fare ────────────────────────────────────────────────────────────────
export function flatFare(amount: number, label = 'Flat fare'): FareResult {
  return { amount, currency: 'ZAR', strategy: 'flat', breakdown: `R${amount.toFixed(2)} (${label})` };
}