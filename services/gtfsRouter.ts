// services/gtfsRouter.ts
// Multi-modal journey planner — Gautrain, Metrorail, Rea Vaya BRT, Metrobus, Minibus Taxi.
import {
  Stop, haversine, isPeakHour,
  findNearestStop, graphs, dijkstra,
  getGautrainFare, getReaVayaFare, METROBUS_FARE,
  getNextDepartureMinutes,
} from './transportData';
import { getMetrorailFare } from '@/constants/metrorailFares';
import { searchRoutes } from '@/services/saasBridge'; // bridge call for taxi routes

export { allStops } from './transportData';

const WALKING_SPEED_KMH     = 5;
const MAX_WALK_KM           = 2.0;
const MAX_WALK_METRORAIL_KM = 3.0;
const TAXI_AVG_SPEED_KPH    = 25;
const TAXI_WAIT_MIN         = 5;

export interface Leg {
  mode:           'WALK' | 'RAIL' | 'BUS' | 'TAXI';
  from:           Stop;
  to:             Stop;
  startTime:      Date;
  endTime:        Date;
  durationSec:    number;
  distanceKm?:    number;
  routeShortName?: string;
  fare?:          number;
  stops?:         string[];
  stopCount?:     number;
}

export interface Itinerary {
  id:              string;
  legs:            Leg[];
  totalDurationSec: number;
  totalFare:       number;
  departureTime:   Date;
  arrivalTime:     Date;
  transferCount:   number;
  systemName:      string;
}

function walkSec(km: number): number {
  return km <= 0 ? 0 : Math.round((km / WALKING_SPEED_KMH) * 3600);
}

function makeWalkStop(id: string, name: string, lat: number, lon: number): Stop {
  return { id, name, lat, lon, system: 'walk' as any };
}

function nowMin(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const SYSTEM_LABELS: Record<string, string> = {
  gautrain:  'Gautrain',
  metrorail: 'Metrorail',
  reavaya:   'Rea Vaya BRT',
  metrobus:  'Metrobus',
  taxi:      'Minibus Taxi',
};

function buildItinerary(
  system:    'gautrain' | 'metrorail' | 'reavaya' | 'metrobus',
  fromLat:   number, fromLng: number,
  toLat:     number, toLng:   number,
  departure: Date,
  peak:      boolean,
  maxWalkKm: number,
): Itinerary | null {
  const originStop = findNearestStop(fromLat, fromLng, system);
  const destStop   = findNearestStop(toLat,   toLng,   system);
  if (!originStop || !destStop || originStop.id === destStop.id) return null;

  const walkToKm   = haversine(fromLat, fromLng, originStop.lat, originStop.lon);
  const walkFromKm = haversine(toLat,   toLng,   destStop.lat,   destStop.lon);
  if (walkToKm > maxWalkKm) return null;

  // For Metrorail, use distance-based travel time instead of graph
  let transitMins = 0;
  if (system === 'metrorail') {
    const distKm = haversine(originStop.lat, originStop.lon, destStop.lat, destStop.lon);
    const SPEED_KPH = 40; // Metrorail average speed
    transitMins = Math.round((distKm / SPEED_KPH) * 60);
    // Ensure at least 2 minutes per stop (approx)
    const stopCount = Math.round(distKm / 2); // rough stop spacing 2 km
    transitMins = Math.max(transitMins, stopCount * 2);
  } else {
    const route = dijkstra(graphs[system], originStop.name, destStop.name);
    if (!route || route.totalMinutes === 0) return null;
    transitMins = route.totalMinutes;
  }

  const waitMins  = getNextDepartureMinutes(system, originStop.name, nowMin(departure), destStop.name);
  const wt        = walkSec(walkToKm);
  const ws        = waitMins * 60;
  const tr        = transitMins * 60;
  const wf        = walkSec(walkFromKm);

  const t0 = departure.getTime();
  const t1 = t0 + wt * 1000;
  const t2 = t1 + ws * 1000;
  const t3 = t2 + tr * 1000;
  const t4 = t3 + wf * 1000;

  let fare = 0;
  let mode: 'RAIL' | 'BUS' = 'BUS';

  if (system === 'gautrain') {
    fare = getGautrainFare(originStop.name, destStop.name, peak);
    mode = 'RAIL';
  } else if (system === 'metrorail') {
    const distKm = haversine(originStop.lat, originStop.lon, destStop.lat, destStop.lon);
    fare = getMetrorailFare(distKm, 'metro');
    mode = 'RAIL';
  } else if (system === 'reavaya') {
    const km = haversine(originStop.lat, originStop.lon, destStop.lat, destStop.lon);
    fare = getReaVayaFare(km, peak);
    mode = 'BUS';
  } else {
    fare = METROBUS_FARE;
    mode = 'BUS';
  }

  const origin = makeWalkStop('origin', 'Origin', fromLat, fromLng);
  const dest   = makeWalkStop('dest',   'Destination', toLat, toLng);

  const legs: Leg[] = [];
  if (wt > 0) legs.push({
    mode: 'WALK', from: origin, to: originStop,
    startTime: new Date(t0), endTime: new Date(t1),
    durationSec: wt, distanceKm: walkToKm,
  });
  legs.push({
    mode, from: originStop, to: destStop,
    startTime: new Date(t2), endTime: new Date(t3),
    durationSec: tr,
    routeShortName: SYSTEM_LABELS[system],
    fare,
    stops:     system !== 'metrorail' ? (dijkstra(graphs[system], originStop.name, destStop.name)?.path || []) : undefined,
    stopCount: system !== 'metrorail' ? (dijkstra(graphs[system], originStop.name, destStop.name)?.stopCount || 0) : undefined,
  });
  if (wf > 0) legs.push({
    mode: 'WALK', from: destStop, to: dest,
    startTime: new Date(t3), endTime: new Date(t4),
    durationSec: wf, distanceKm: walkFromKm,
  });

  return {
    id:              `${system}-${originStop.id}-${destStop.id}`,
    legs,
    totalDurationSec: wt + ws + tr + wf,
    totalFare:       fare,
    departureTime:   departure,
    arrivalTime:     new Date(t4),
    transferCount:   0,
    systemName:      SYSTEM_LABELS[system],
  };
}

function buildTaxiItinerary(
  route: any,
  fromName: string,
  toName: string,
  departure: Date,
): Itinerary | null {
  if (!route) return null;
  const distanceKm = route.distance;
  const travelSec = Math.round((distanceKm / TAXI_AVG_SPEED_KPH) * 3600);
  const waitSec = TAXI_WAIT_MIN * 60;
  const totalSec = waitSec + travelSec;
  const startTime = departure.getTime();
  const waitEnd = startTime + waitSec * 1000;
  const travelEnd = waitEnd + travelSec * 1000;
  const originStop: Stop = { id: `taxi-origin-${route.$id}`, name: route.origin, lat: 0, lon: 0, system: 'taxi' };
  const destStop: Stop = { id: `taxi-dest-${route.$id}`, name: route.destination, lat: 0, lon: 0, system: 'taxi' };
  const legs: Leg[] = [{
    mode: 'TAXI', from: originStop, to: destStop,
    startTime: new Date(waitEnd), endTime: new Date(travelEnd),
    durationSec: travelSec, distanceKm: distanceKm,
    routeShortName: route.name, fare: route.baseFare,
  }];
  return {
    id: `taxi-${route.$id}`,
    legs,
    totalDurationSec: totalSec,
    totalFare: route.baseFare,
    departureTime: departure,
    arrivalTime: new Date(travelEnd),
    transferCount: 0,
    systemName: 'Minibus Taxi',
  };
}

export async function findItineraries(
  fromLat: number, fromLng: number,
  toLat:   number, toLng:   number,
  date:    Date,   time:    Date,
  selectedModes: string[],
  tripType: 'fastest' | 'cheapest' = 'fastest',
  fromName?: string,
  toName?: string,
): Promise<Itinerary[]> {
  if ([fromLat, fromLng, toLat, toLng].some(n => !isFinite(n))) return [];

  const departure = new Date(date);
  departure.setHours(time.getHours(), time.getMinutes(), 0, 0);
  const peak = isPeakHour(departure);
  const results: Itinerary[] = [];

  // Walking-only option
  if (selectedModes.includes('Walk')) {
    const km  = haversine(fromLat, fromLng, toLat, toLng);
    const sec = walkSec(km);
    const arr = new Date(departure.getTime() + sec * 1000);
    const o   = makeWalkStop('origin', 'Origin', fromLat, fromLng);
    const d   = makeWalkStop('dest',   'Destination', toLat, toLng);
    results.push({
      id:   'walk-only',
      legs: [{ mode: 'WALK', from: o, to: d, startTime: departure, endTime: arr, durationSec: sec, distanceKm: km }],
      totalDurationSec: sec,
      totalFare:        0,
      departureTime:    departure,
      arrivalTime:      arr,
      transferCount:    0,
      systemName:       'Walking',
    });
  }

  // Rail modes
  if (selectedModes.includes('Rail')) {
    const gt = buildItinerary('gautrain',  fromLat, fromLng, toLat, toLng, departure, peak, MAX_WALK_KM);
    if (gt) results.push(gt);
    const mr = buildItinerary('metrorail', fromLat, fromLng, toLat, toLng, departure, peak, MAX_WALK_METRORAIL_KM);
    if (mr) results.push(mr);
  }

  // Bus modes
  if (selectedModes.includes('Bus')) {
    const rv = buildItinerary('reavaya',  fromLat, fromLng, toLat, toLng, departure, peak, MAX_WALK_KM);
    if (rv) results.push(rv);
    const mb = buildItinerary('metrobus', fromLat, fromLng, toLat, toLng, departure, peak, MAX_WALK_KM);
    if (mb) results.push(mb);
  }

  // Taxi mode
  if (selectedModes.includes('Taxi') && fromName && toName) {
    try {
      const taxiRoutes = await searchRoutes(fromName, toName);
      for (const route of taxiRoutes) {
        const it = await buildTaxiItinerary(route, fromName, toName, departure);
        if (it) results.push(it);
      }
    } catch (err) {
      console.warn('Taxi route fetch failed:', err);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = results.filter(it => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });

  unique.sort((a, b) =>
    tripType === 'cheapest'
      ? a.totalFare !== b.totalFare
        ? a.totalFare - b.totalFare
        : a.totalDurationSec - b.totalDurationSec
      : a.totalDurationSec !== b.totalDurationSec
        ? a.totalDurationSec - b.totalDurationSec
        : a.totalFare - b.totalFare,
  );

  return unique;
}

export type { Stop };