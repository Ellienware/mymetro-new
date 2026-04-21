// services/transportData.ts
// Single source of truth for all stop/station data and graph structures.
// Loaded once at module level so Dijkstra runs fast on every query.
import gautrainRaw from '@/assets/gautrain_data.json';
import metrorailRaw from '@/assets/metrorail_data.json';
import reavayaRaw from '@/assets/reavaya_data.json';
import metrobusRaw from '@/assets/metrobus_data.json';

// ─── Public types ──────────────────────────────
export type TransitSystem = 'gautrain' | 'metrorail' | 'metrobus' | 'reavaya' | 'walk' | 'taxi';

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  system: TransitSystem;
}

export interface GraphEdge {
  to: string;   // stop name
  minutes: number;
}

export type StopGraph = Record<string, GraphEdge[]>;

// ─── Fares ────────────────────────────────────
// Gautrain: distance-based fare table (from official tariffs)
const GAUTRAIN_FARES: Record<string, { peak: number; offPeak: number }> = {
  'Hatfield,Pretoria': { peak: 21.00, offPeak: 16.80 },
  'Hatfield,Centurion': { peak: 33.00, offPeak: 26.40 },
  'Hatfield,Midrand': { peak: 41.00, offPeak: 32.80 },
  'Hatfield,Marlboro': { peak: 49.00, offPeak: 39.20 },
  'Hatfield,Sandton': { peak: 55.00, offPeak: 44.00 },
  'Hatfield,Rosebank': { peak: 58.00, offPeak: 46.40 },
  'Hatfield,Park': { peak: 61.00, offPeak: 48.80 },
  'Hatfield,Rhodesfield': { peak: 55.00, offPeak: 44.00 },
  'Hatfield,OR Tambo': { peak: 58.00, offPeak: 46.40 },
  'Pretoria,Centurion': { peak: 16.00, offPeak: 12.80 },
  'Pretoria,Midrand': { peak: 28.00, offPeak: 22.40 },
  'Pretoria,Marlboro': { peak: 38.00, offPeak: 30.40 },
  'Pretoria,Sandton': { peak: 43.00, offPeak: 34.40 },
  'Pretoria,Rosebank': { peak: 46.00, offPeak: 36.80 },
  'Pretoria,Park': { peak: 49.00, offPeak: 39.20 },
  'Centurion,Midrand': { peak: 21.00, offPeak: 16.80 },
  'Centurion,Marlboro': { peak: 31.00, offPeak: 24.80 },
  'Centurion,Sandton': { peak: 36.00, offPeak: 28.80 },
  'Centurion,Rosebank': { peak: 39.00, offPeak: 31.20 },
  'Centurion,Park': { peak: 42.00, offPeak: 33.60 },
  'Midrand,Marlboro': { peak: 19.00, offPeak: 15.20 },
  'Midrand,Sandton': { peak: 24.00, offPeak: 19.20 },
  'Midrand,Rosebank': { peak: 27.00, offPeak: 21.60 },
  'Midrand,Park': { peak: 30.00, offPeak: 24.00 },
  'Marlboro,Sandton': { peak: 13.00, offPeak: 10.40 },
  'Marlboro,Rosebank': { peak: 16.00, offPeak: 12.80 },
  'Marlboro,Park': { peak: 19.00, offPeak: 15.20 },
  'Marlboro,Rhodesfield': { peak: 16.00, offPeak: 12.80 },
  'Marlboro,OR Tambo': { peak: 19.00, offPeak: 15.20 },
  'Sandton,Rosebank': { peak: 10.00, offPeak: 8.00 },
  'Sandton,Park': { peak: 16.00, offPeak: 12.80 },
  'Sandton,Rhodesfield': { peak: 21.00, offPeak: 16.80 },
  'Sandton,OR Tambo': { peak: 26.00, offPeak: 20.80 },
  'Rosebank,Park': { peak: 10.00, offPeak: 8.00 },
  'Rhodesfield,OR Tambo': { peak: 10.00, offPeak: 8.00 },
};

export function getGautrainFare(from: string, to: string, peak: boolean): number {
  const key = `${from},${to}`;
  const revKey = `${to},${from}`;
  const entry = GAUTRAIN_FARES[key] ?? GAUTRAIN_FARES[revKey];
  if (!entry) return peak ? 20 : 16; // fallback
  return peak ? entry.peak : entry.offPeak;
}

// Metrorail zones (Metrorail uses a zone-based system)
export function getMetrorailFare(stopsTraversed: number): number {
  if (stopsTraversed <= 3) return 9.50;
  if (stopsTraversed <= 6) return 13.00;
  if (stopsTraversed <= 10) return 17.50;
  if (stopsTraversed <= 15) return 22.50;
  return 28.00;
}

// Rea Vaya fare brackets by distance
const REAVAYA_FARE_TABLE = [
  { maxKm: 5, peak: 11.00, offPeak: 9.90 },
  { maxKm: 10, peak: 14.00, offPeak: 12.60 },
  { maxKm: 15, peak: 16.50, offPeak: 14.85 },
  { maxKm: 25, peak: 19.00, offPeak: 17.10 },
  { maxKm: 35, peak: 21.00, offPeak: 18.90 },
  { maxKm: Infinity, peak: 28.00, offPeak: 25.20 },
];

export function getReaVayaFare(distanceKm: number, peak: boolean): number {
  const b = REAVAYA_FARE_TABLE.find(b => distanceKm <= b.maxKm);
  if (!b) return peak ? 28 : 25.20;
  return peak ? b.peak : b.offPeak;
}

// Metrobus flat fare
export const METROBUS_FARE = 12.00;

// ─── Helpers ──────────────────────────────────
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isPeakHour(time: Date): boolean {
  const h = time.getHours();
  return (h >= 6 && h < 9) || (h >= 15 && h < 18);
}

function parseMinutes(timeStr: string): number {
  const parts = timeStr.replace('s', '').split(':').map(Number);
  if (parts.length >= 2) return parts[0] * 60 + parts[1];
  return 0;
}

// ─── Build stop index ──────────────────────────

// Gautrain
const gautrainStops: Stop[] = ((gautrainRaw as any).stations as any[]).map((s: any) => ({
  id: s.id, name: s.name, lat: s.lat, lon: s.lon, system: 'gautrain' as TransitSystem,
}));

// Metrorail — 289 stations, use name deduplication (same name appears multiple times)
const _metrorailByName = new Map<string, Stop>();
for (const s of ((metrorailRaw as any).stations as any[])) {
  if (!_metrorailByName.has(s.name)) {
    _metrorailByName.set(s.name, {
      id: s.id, name: s.name, lat: s.lat, lon: s.lon, system: 'metrorail' as TransitSystem,
    });
  }
}
const metrorailStops: Stop[] = Array.from(_metrorailByName.values());

// Rea Vaya
const reavayaStops: Stop[] = ((reavayaRaw as any).stops as any[]).map((s: any) => ({
  id: s.id, name: s.name, lat: s.lat, lon: s.lon, system: 'rea_vaya' as TransitSystem,
}));

// Metrobus — extract unique named stops from routes, geocode from stop names
// NOTE: The metrobus_data.json has placeholder coords (-26.195, 28.034) for all stops.
// We derive stop positions by parsing route long_names and mapping known Jhb suburb coords.
const JHB_SUBURB_COORDS: Record<string, [number, number]> = {
  'Auckland Park': [-26.1768, 27.9916],
  'Sydenham': [-26.1741, 28.0852],
  'Bellevue East': [-26.1741, 28.0852],
  'Sunninghill': [-26.0333, 28.0667],
  'Fairlands': [-26.1167, 27.9667],
  'Northcliff': [-26.1417, 27.9583],
  'Braamfontein': [-26.1897, 28.0363],
  'Parktown': [-26.1800, 28.0450],
  'Sandton': [-26.1070, 28.0570],
  'Rosebank': [-26.1460, 28.0447],
  'Randburg': [-26.0895, 27.9812],
  'Melville': [-26.1822, 28.0089],
  'Sophiatown': [-26.1748, 28.0195],
  'Westgate': [-26.2025, 28.0375],
  'Crown Gardens': [-26.2333, 27.9833],
  'Soweto': [-26.2678, 27.8587],
  'Roodepoort': [-26.1625, 27.8742],
  'Krugersdorp': [-26.0965, 27.7743],
  'Fourways': [-26.0211, 28.0110],
  'Midrand': [-25.9906, 28.1326],
  'Edenvale': [-26.1318, 28.1579],
  'Bedfordview': [-26.1833, 28.1333],
  'Germiston': [-26.2157, 28.1625],
  'Orange Grove': [-26.1586, 28.0758],
  'Yeoville': [-26.1786, 28.0681],
  'Hillbrow': [-26.1917, 28.0500],
  'Berea': [-26.1858, 28.0600],
  'Joubert Park': [-26.1958, 28.0458],
  'Central': [-26.2058, 28.0408],
  'Newtown': [-26.2003, 28.0286],
  'City Centre': [-26.2041, 28.0473],
};

const _metrobusStops = new Map<string, Stop>();
for (const routeData of Object.values((metrobusRaw as any).routes as any)) {
  const rd = routeData as any;
  for (const stop of (rd.stops as any[])) {
    if (_metrobusStops.has(stop.name)) continue;
    // Try to find real coords from suburb name mapping
    let lat = stop.lat;
    let lon = stop.lon;
    for (const [suburb, coords] of Object.entries(JHB_SUBURB_COORDS)) {
      if (stop.name.toLowerCase().includes(suburb.toLowerCase())) {
        lat = coords[0]; lon = coords[1]; break;
      }
    }
    _metrobusStops.set(stop.name, {
      id: stop.id, name: stop.name, lat, lon, system: 'metrobus' as TransitSystem,
    });
  }
}
const metrobusStops: Stop[] = Array.from(_metrobusStops.values());

// ─── All stops combined ────────────────────────
export const allStops: Stop[] = [
  ...gautrainStops,
  ...metrorailStops,
  ...reavayaStops,
  ...metrobusStops,
];

// Index by system for fast lookup
export const stopsBySystem: Record<TransitSystem, Stop[]> = {
  gautrain: gautrainStops,
  metrorail: metrorailStops,
  reavaya: reavayaStops,
  metrobus: metrobusStops,
  walk: [], // walking stops are created dynamically, not stored
  taxi: [], // taxi stops are not pre-defined
};

// ─── Build adjacency graphs (name → edges) ─────

function buildGraphFromMatrix(matrix: Record<string, number>): StopGraph {
  const graph: StopGraph = {};
  for (const [key, mins] of Object.entries(matrix)) {
    const comma = key.indexOf(',');
    if (comma < 0) continue;
    const from = key.slice(0, comma);
    const to = key.slice(comma + 1);
    if (!graph[from]) graph[from] = [];
    if (!graph[to]) graph[to] = [];
    // Only add if not already present with lower cost
    const existingFwd = graph[from].find(e => e.to === to);
    if (!existingFwd || mins < existingFwd.minutes) {
      graph[from] = graph[from].filter(e => e.to !== to);
      graph[from].push({ to, minutes: mins });
    }
    const existingBwd = graph[to].find(e => e.to === from);
    if (!existingBwd || mins < existingBwd.minutes) {
      graph[to] = graph[to].filter(e => e.to !== from);
      graph[to].push({ to: from, minutes: mins });
    }
  }
  return graph;
}

function buildGraphFromRoutes(routesObj: any): StopGraph {
  const graph: StopGraph = {};
  for (const routeData of Object.values(routesObj) as any[]) {
    const stopTimes: any[] = routeData.stopTimes ?? [];
    const stopsArr: any[] = routeData.stops ?? [];
    const stopIdToName = new Map<string, string>();
    for (const s of stopsArr) stopIdToName.set(s.id, s.name);
    for (let i = 0; i < stopTimes.length - 1; i++) {
      const fromName = stopIdToName.get(stopTimes[i].stop_id);
      const toName = stopIdToName.get(stopTimes[i + 1].stop_id);
      if (!fromName || !toName || fromName === toName) continue;
      try {
        const dep = parseMinutes(stopTimes[i].departure_time);
        const arr = parseMinutes(stopTimes[i + 1].arrival_time);
        const mins = arr - dep;
        if (mins <= 0) continue;
        if (!graph[fromName]) graph[fromName] = [];
        const existing = graph[fromName].find(e => e.to === toName);
        if (!existing || mins < existing.minutes) {
          graph[fromName] = graph[fromName].filter(e => e.to !== toName);
          graph[fromName].push({ to: toName, minutes: mins });
        }
        // Bidirectional
        if (!graph[toName]) graph[toName] = [];
        const existingRev = graph[toName].find(e => e.to === fromName);
        if (!existingRev || mins < existingRev.minutes) {
          graph[toName] = graph[toName].filter(e => e.to !== fromName);
          graph[toName].push({ to: fromName, minutes: mins });
        }
      } catch { continue; }
    }
  }
  return graph;
}

export const graphs: Record<TransitSystem, StopGraph> = {
  gautrain: buildGraphFromMatrix((gautrainRaw as any).travelTimeMatrix ?? {}),
  metrorail: buildGraphFromMatrix((metrorailRaw as any).travelTimeMatrix ?? {}),
  reavaya: buildGraphFromMatrix((reavayaRaw as any).travelTimeMatrix ?? {}),
  metrobus: buildGraphFromRoutes((metrobusRaw as any).routes ?? {}),
  walk: {}, // no graph for walking
  taxi: {}, // no graph for taxi (it uses distance-based travel)
};

// ─── Departure schedules ───────────────────────
// Gautrain departures keyed by "stationName" → { South: string[], North: string[], East: string[], West: string[] }
export const gautrainDepartures: Record<string, Record<string, string[]>> =
  (gautrainRaw as any).departures ?? {};

// Metrorail departures keyed by "stationName" → string[] (flat list, no direction)
export const metrorailDepartures: Record<string, string[]> =
  (metrorailRaw as any).departures ?? {};

// Rea Vaya has no departures data — use frequency fallback
export const REAVAYA_FREQUENCY = { peakMins: 10, offPeakMins: 20 };

// Metrobus frequency from route data
export function getMetrobusFrequency(routeId: string): { peakMins: number; offPeakMins: number } {
  const route = ((metrobusRaw as any).routes ?? {})[routeId];
  const freq = route?.frequency ?? {};
  return {
    peakMins: freq.peak_headway_mins ?? 20,
    offPeakMins: freq.off_peak_headway_mins ?? 30,
  };
}

// ─── Nearest stop finder ───────────────────────
export function findNearestStop(lat: number, lon: number, system: TransitSystem): Stop | null {
  const candidates = stopsBySystem[system];
  if (!candidates.length) return null;
  let best: Stop | null = null;
  let bestDist = Infinity;
  for (const s of candidates) {
    const d = haversine(lat, lon, s.lat, s.lon);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

// Find N nearest stops to a point, optionally filtered by system
export function findNearestStops(lat: number, lon: number, system: TransitSystem, n = 3): Stop[] {
  const candidates = stopsBySystem[system];
  return candidates
    .map(s => ({ stop: s, dist: haversine(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, n)
    .map(x => x.stop);
}

// ─── Dijkstra (returns path + total minutes) ───
export interface DijkstraResult {
  totalMinutes: number;
  path: string[]; // stop names
  stopCount: number;
}

export function dijkstra(graph: StopGraph, start: string, end: string): DijkstraResult | null {
  if (start === end) return { totalMinutes: 0, path: [start], stopCount: 0 };
  if (!graph[start]) return null;

  const dist: Record<string, number> = { [start]: 0 };
  const prev: Record<string, string> = {};
  // Min-heap: [cost, nodeName]
  const heap: [number, string][] = [[0, start]];

  while (heap.length) {
    heap.sort((a, b) => a[0] - b[0]);
    const [cost, node] = heap.shift()!;
    if (cost > (dist[node] ?? Infinity)) continue;
    if (node === end) break;
    for (const { to, minutes } of (graph[node] ?? [])) {
      const nc = cost + minutes;
      if (nc < (dist[to] ?? Infinity)) {
        dist[to] = nc;
        prev[to] = node;
        heap.push([nc, to]);
      }
    }
  }

  if (dist[end] === undefined) return null;

  // Reconstruct path
  const path: string[] = [];
  let cur = end;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev[cur];
  }

  return {
    totalMinutes: dist[end],
    path,
    stopCount: path.length - 1,
  };
}

// ─── Next departure helper ─────────────────────
export function getNextDepartureMinutes(
  system: TransitSystem,
  stopName: string,
  nowMinutes: number, // minutes since midnight
  destinationName?: string,
): number {
  // Returns wait time in minutes until next departure

  if (system === 'gautrain') {
    const deps = gautrainDepartures[stopName];
    if (!deps) return 5; // assume short wait
    // Determine direction based on line order
    const northLine = ['Hatfield', 'Pretoria', 'Centurion', 'Midrand', 'Marlboro', 'Sandton', 'Rosebank', 'Park'];
    const eastLine = ['Sandton', 'Marlboro', 'Rhodesfield', 'OR Tambo'];
    let direction = 'South';
    if (destinationName) {
      const ni = northLine.indexOf(stopName), nj = northLine.indexOf(destinationName);
      const ei = eastLine.indexOf(stopName), ej = eastLine.indexOf(destinationName);
      if (ni >= 0 && nj >= 0) direction = nj > ni ? 'South' : 'North';
      else if (ei >= 0 && ej >= 0) direction = ej > ei ? 'East' : 'West';
    }
    const times: string[] = deps[direction] ?? (deps['South'] ?? []);
    for (const t of times) {
      const [h, m] = t.split(':').map(Number);
      const depMin = h * 60 + m;
      if (depMin >= nowMinutes) return depMin - nowMinutes;
    }
    return 15; // after last departure, assume 15 min buffer
  }

  if (system === 'metrorail') {
    const times = metrorailDepartures[stopName];
    if (!times || !times.length) return 8; // average headway
    for (const t of times) {
      const [h, m] = t.split(':').map(Number);
      const depMin = h * 60 + m;
      if (depMin >= nowMinutes) return depMin - nowMinutes;
    }
    return 15;
  }

  if (system === 'reavaya') {
    const isPeak = (nowMinutes >= 360 && nowMinutes < 540) || (nowMinutes >= 900 && nowMinutes < 1080);
    return isPeak ? REAVAYA_FREQUENCY.peakMins / 2 : REAVAYA_FREQUENCY.offPeakMins / 2;
  }

  if (system === 'metrobus') {
    const isPeak = (nowMinutes >= 360 && nowMinutes < 540) || (nowMinutes >= 900 && nowMinutes < 1080);
    return isPeak ? 10 : 15;
  }

  return 5;
}