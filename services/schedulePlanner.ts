// // services/schedulePlanner.ts
// import { allStops, haversine, Stop } from './transportData';
// import { getGautrainFare } from '@/constants/gautrainFares';
// import { getMetrorailFare } from '@/constants/metrorailFares';
// import gautrainData from '@/assets/gautrain_data.json';
// import metrorailData from '@/assets/metrorail_data.json';
// import metrobusData from '@/assets/metrobus_data.json';
// import reavayaData from '@/assets/reavaya_data.json';

// const WALK_SPEED_KPH = 5;
// const WALK_SPEED_MPS = WALK_SPEED_KPH / 3.6;
// const MIN_TRANSFER_TIME = 120;
// const MAX_WALK_KM = 2;

// export interface TransitConnection {
//   fromStopId: string;
//   toStopId: string;
//   departureTime: number;
//   arrivalTime: number;
//   routeShortName: string;
//   mode: 'RAIL' | 'BUS';
// }

// // ----------------------------------------------------------------------
// // 1. Build connections from departure matrices
// // ----------------------------------------------------------------------
// function buildConnectionsFromDepartureMatrix(
//   stations: Stop[],
//   departures: Record<string, string[]>,
//   travelTimeMatrix: Record<string, number>,
//   mode: 'RAIL' | 'BUS',
//   routeName: string
// ): TransitConnection[] {
//   const connections: TransitConnection[] = [];
//   if (!Array.isArray(stations) || stations.length === 0) return connections;
//   const stationMap = new Map(stations.map(s => [s.name, s]));

//   for (const fromName in departures) {
//     const fromStop = stationMap.get(fromName);
//     if (!fromStop) continue;
//     const times = departures[fromName];
//     if (!Array.isArray(times)) continue;
//     for (const timeStr of times) {
//       const [h, m] = timeStr.split(':').map(Number);
//       const depSec = h * 3600 + m * 60;
//       for (const toStop of stations) {
//         if (toStop.id === fromStop.id) continue;
//         const key = `${fromStop.name},${toStop.name}`;
//         const revKey = `${toStop.name},${fromStop.name}`;
//         const travelMins = travelTimeMatrix[key] ?? travelTimeMatrix[revKey];
//         if (!travelMins) continue;
//         const arrSec = depSec + travelMins * 60;
//         connections.push({
//           fromStopId: fromStop.id,
//           toStopId: toStop.id,
//           departureTime: depSec,
//           arrivalTime: arrSec,
//           routeShortName: routeName,
//           mode,
//         });
//       }
//     }
//   }
//   return connections;
// }

// // ----------------------------------------------------------------------
// // 2. Build connections from stopTimes (Metrobus / Rea Vaya)
// // ----------------------------------------------------------------------
// function buildConnectionsFromStopTimes(
//   routes: any,
//   mode: 'RAIL' | 'BUS'
// ): TransitConnection[] {
//   const connections: TransitConnection[] = [];
//   if (!routes || typeof routes !== 'object') return connections;

//   for (const routeId in routes) {
//     const route = routes[routeId];
//     const stops = route?.stops;
//     const stopTimes = route?.stopTimes;
//     if (!Array.isArray(stops) || !Array.isArray(stopTimes)) continue;

//     for (let i = 0; i < stopTimes.length - 1; i++) {
//       const fromStop = stops.find((s: any) => s.id === stopTimes[i].stop_id);
//       const toStop = stops.find((s: any) => s.id === stopTimes[i + 1].stop_id);
//       if (!fromStop || !toStop) continue;
//       const depTimeStr = stopTimes[i].departure_time;
//       const arrTimeStr = stopTimes[i + 1].arrival_time;
//       const [dh, dm, ds] = depTimeStr.split(':').map(Number);
//       const [ah, am, as] = arrTimeStr.split(':').map(Number);
//       const depSec = dh * 3600 + dm * 60 + (ds || 0);
//       const arrSec = ah * 3600 + am * 60 + (as || 0);
//       connections.push({
//         fromStopId: fromStop.id,
//         toStopId: toStop.id,
//         departureTime: depSec,
//         arrivalTime: arrSec,
//         routeShortName: route.short_name || routeId,
//         mode,
//       });
//     }
//   }
//   return connections;
// }

// // ----------------------------------------------------------------------
// // 3. Load stops and build connections with fallbacks
// // ----------------------------------------------------------------------
// const gautrainStations = (gautrainData as any)?.stations;
// const metrorailStations = (metrorailData as any)?.stations;

// const gautrainStops: Stop[] = Array.isArray(gautrainStations)
//   ? gautrainStations.map((s: any) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, system: 'gautrain' as const }))
//   : [];

// const metrorailStops: Stop[] = Array.isArray(metrorailStations)
//   ? metrorailStations.map((s: any) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, system: 'metrorail' as const }))
//   : [];

// const gautrainConnections = buildConnectionsFromDepartureMatrix(
//   gautrainStops,
//   (gautrainData as any)?.departures ?? {},
//   (gautrainData as any)?.travelTimeMatrix ?? {},
//   'RAIL',
//   'Gautrain'
// );
// const metrorailConnections = buildConnectionsFromDepartureMatrix(
//   metrorailStops,
//   (metrorailData as any)?.departures ?? {},
//   (metrorailData as any)?.travelTimeMatrix ?? {},
//   'RAIL',
//   'Metrorail'
// );
// const metrobusConnections = buildConnectionsFromStopTimes(
//   (metrobusData as any)?.routes,
//   'BUS'
// );
// const reavayaConnections = buildConnectionsFromStopTimes(
//   (reavayaData as any)?.routeDetails,
//   'BUS'
// );

// // Ensure each is an array
// const allConnectionArrays = [
//   gautrainConnections,
//   metrorailConnections,
//   metrobusConnections,
//   reavayaConnections,
// ].filter(arr => Array.isArray(arr));

// export const allConnections: TransitConnection[] = ([] as TransitConnection[]).concat(...allConnectionArrays);

// console.log(`[schedulePlanner] Built ${allConnections.length} connections`);

// // ----------------------------------------------------------------------
// // 4. Index connections by fromStopId
// // ----------------------------------------------------------------------
// const connectionsByStop = new Map<string, TransitConnection[]>();
// if (Array.isArray(allConnections)) {
//   allConnections.forEach(conn => {
//     if (!connectionsByStop.has(conn.fromStopId)) {
//       connectionsByStop.set(conn.fromStopId, []);
//     }
//     connectionsByStop.get(conn.fromStopId)!.push(conn);
//   });
//   // Sort each list by departure time
//   connectionsByStop.forEach(conns => {
//     conns.sort((a, b) => a.departureTime - b.departureTime);
//   });
// }

// // ----------------------------------------------------------------------
// // 5. Helper functions
// // ----------------------------------------------------------------------
// export function findNextConnection(
//   fromStopId: string,
//   targetStopId: string,
//   afterTimeSec: number
// ): TransitConnection | null {
//   const conns = connectionsByStop.get(fromStopId);
//   if (!conns) return null;
//   let best: TransitConnection | null = null;
//   for (const conn of conns) {
//     if (conn.departureTime >= afterTimeSec && conn.toStopId === targetStopId) {
//       if (!best || conn.departureTime < best.departureTime) best = conn;
//     }
//   }
//   return best;
// }

// function findStopById(id: string): Stop | undefined {
//   return allStops.find(s => s.id === id);
// }

// function walkingTime(distanceKm: number): number {
//   return Math.round((distanceKm * 1000) / WALK_SPEED_MPS);
// }

// function getFareForLeg(leg: PlannedLeg, isPeak: boolean): number {
//   if (leg.mode === 'WALK') return 0;
//   const from = leg.from;
//   const to = leg.to;
//   switch (from.system) {
//     case 'gautrain':
//       return getGautrainFare(from.name, to.name, isPeak);
//     case 'metrorail': {
//       const dist = haversine(from.lat, from.lon, to.lat, to.lon);
//       return getMetrorailFare(dist, 'metro');
//     }
//     default:
//       return 12;
//   }
// }

// // ----------------------------------------------------------------------
// // 6. Interfaces
// // ----------------------------------------------------------------------
// export interface PlannedLeg {
//   mode: 'WALK' | 'RAIL' | 'BUS';
//   from: Stop;
//   to: Stop;
//   startTime: Date;
//   endTime: Date;
//   durationSec: number;
//   distanceKm?: number;
//   routeShortName?: string;
//   fare?: number;
// }

// export interface PlannedItinerary {
//   legs: PlannedLeg[];
//   totalDurationSec: number;
//   totalFare: number;
//   departureTime: Date;
//   arrivalTime: Date;
//   transferCount: number;
// }

// // ----------------------------------------------------------------------
// // 7. Main search function
// // ----------------------------------------------------------------------
// export async function findScheduleBasedItineraries(
//   fromLat: number, fromLng: number,
//   toLat: number, toLng: number,
//   departureDate: Date,
//   selectedModes: string[],
//   tripType: 'fastest' | 'cheapest' = 'fastest'
// ): Promise<PlannedItinerary[]> {
//   const startTimeSec = departureDate.getHours() * 3600 + departureDate.getMinutes() * 60;

//   // Find walkable stops
//   const originStops: { stop: Stop; walkSec: number }[] = [];
//   const destStops: { stop: Stop; walkSec: number }[] = [];

//   for (const stop of allStops) {
//     if (selectedModes.includes('Rail') && (stop.system === 'gautrain' || stop.system === 'metrorail')) {
//       const dist = haversine(fromLat, fromLng, stop.lat, stop.lon);
//       if (dist <= MAX_WALK_KM) originStops.push({ stop, walkSec: walkingTime(dist) });
//       const distToDest = haversine(toLat, toLng, stop.lat, stop.lon);
//       if (distToDest <= MAX_WALK_KM) destStops.push({ stop, walkSec: walkingTime(distToDest) });
//     }
//     if (selectedModes.includes('Bus') && (stop.system === 'metrobus' || stop.system === 'reavaya')) {
//       const dist = haversine(fromLat, fromLng, stop.lat, stop.lon);
//       if (dist <= MAX_WALK_KM) originStops.push({ stop, walkSec: walkingTime(dist) });
//       const distToDest = haversine(toLat, toLng, stop.lat, stop.lon);
//       if (distToDest <= MAX_WALK_KM) destStops.push({ stop, walkSec: walkingTime(distToDest) });
//     }
//   }

//   // Direct walk option
//   const directWalkDist = haversine(fromLat, fromLng, toLat, toLng);
//   const directWalkSec = walkingTime(directWalkDist);
//   const directItinerary: PlannedItinerary | null = directWalkDist <= MAX_WALK_KM ? {
//     legs: [{
//       mode: 'WALK',
//       from: { id: 'origin', name: 'Origin', lat: fromLat, lon: fromLng, system: 'walk' } as Stop,
//       to: { id: 'dest', name: 'Destination', lat: toLat, lon: toLng, system: 'walk' } as Stop,
//       startTime: departureDate,
//       endTime: new Date(departureDate.getTime() + directWalkSec * 1000),
//       durationSec: directWalkSec,
//       distanceKm: directWalkDist,
//     }],
//     totalDurationSec: directWalkSec,
//     totalFare: 0,
//     departureTime: departureDate,
//     arrivalTime: new Date(departureDate.getTime() + directWalkSec * 1000),
//     transferCount: 0,
//   } : null;

//   // If there are no transit connections at all, return only walking
//   if (allConnections.length === 0) {
//     console.warn('[schedulePlanner] No transit connections available');
//     return directItinerary ? [directItinerary] : [];
//   }

//   // Dijkstra search
//   const bestArrival = new Map<string, number>();
//   const bestPath = new Map<string, { arrivalSec: number; prevStopId: string; connection: TransitConnection | null }>();
//   const queue: { stopId: string; arrivalSec: number }[] = [];

//   for (const { stop, walkSec } of originStops) {
//     const arrivalSec = startTimeSec + walkSec;
//     if (!bestArrival.has(stop.id) || arrivalSec < bestArrival.get(stop.id)!) {
//       bestArrival.set(stop.id, arrivalSec);
//       bestPath.set(stop.id, { arrivalSec, prevStopId: '', connection: null });
//       queue.push({ stopId: stop.id, arrivalSec });
//     }
//   }

//   while (queue.length) {
//     queue.sort((a, b) => a.arrivalSec - b.arrivalSec);
//     const { stopId, arrivalSec } = queue.shift()!;
//     if (bestArrival.get(stopId) !== arrivalSec) continue;

//     const conns = connectionsByStop.get(stopId) || [];
//     for (const conn of conns) {
//       if (conn.departureTime < arrivalSec + MIN_TRANSFER_TIME) continue;
//       const newArrival = conn.arrivalTime;
//       const existing = bestArrival.get(conn.toStopId);
//       if (!existing || newArrival < existing) {
//         bestArrival.set(conn.toStopId, newArrival);
//         bestPath.set(conn.toStopId, { arrivalSec: newArrival, prevStopId: stopId, connection: conn });
//         queue.push({ stopId: conn.toStopId, arrivalSec: newArrival });
//       }
//     }
//   }

//   // Build itineraries
//   const itineraries: PlannedItinerary[] = [];
//   for (const { stop: destStop, walkSec: finalWalkSec } of destStops) {
//     const arrivalAtStop = bestArrival.get(destStop.id);
//     if (arrivalAtStop === undefined) continue;
//     const totalSec = arrivalAtStop + finalWalkSec;

//     const legs: PlannedLeg[] = [];

//     // Final walk leg
//     legs.push({
//       mode: 'WALK',
//       from: destStop,
//       to: { id: 'dest', name: 'Destination', lat: toLat, lon: toLng, system: 'walk' } as Stop,
//       startTime: new Date(departureDate.getTime() + (arrivalAtStop - startTimeSec) * 1000),
//       endTime: new Date(departureDate.getTime() + totalSec * 1000),
//       durationSec: finalWalkSec,
//       distanceKm: haversine(destStop.lat, destStop.lon, toLat, toLng),
//     });

//     // Backtrack transit legs
//     let currentStopId = destStop.id;
//     let node = bestPath.get(currentStopId);
//     while (node && node.connection) {
//       const conn = node.connection;
//       const fromStop = findStopById(conn.fromStopId);
//       const toStop = findStopById(conn.toStopId);
//       if (!fromStop || !toStop) break;
//       const depTime = new Date(departureDate.getTime() + (conn.departureTime - startTimeSec) * 1000);
//       const arrTime = new Date(departureDate.getTime() + (conn.arrivalTime - startTimeSec) * 1000);
//       legs.unshift({
//         mode: conn.mode,
//         from: fromStop,
//         to: toStop,
//         startTime: depTime,
//         endTime: arrTime,
//         durationSec: conn.arrivalTime - conn.departureTime,
//         routeShortName: conn.routeShortName,
//       });
//       currentStopId = conn.fromStopId;
//       node = bestPath.get(currentStopId);
//     }

//     // Initial walk leg
//     const firstStop = findStopById(currentStopId);
//     if (firstStop) {
//       const walkToFirst = originStops.find(os => os.stop.id === firstStop.id);
//       if (walkToFirst) {
//         const walkSec = walkToFirst.walkSec;
//         legs.unshift({
//           mode: 'WALK',
//           from: { id: 'origin', name: 'Origin', lat: fromLat, lon: fromLng, system: 'walk' } as Stop,
//           to: firstStop,
//           startTime: departureDate,
//           endTime: new Date(departureDate.getTime() + walkSec * 1000),
//           durationSec: walkSec,
//           distanceKm: haversine(fromLat, fromLng, firstStop.lat, firstStop.lon),
//         });
//       }
//     }

//     const isPeak = (departureDate.getHours() >= 6 && departureDate.getHours() < 9) ||
//                    (departureDate.getHours() >= 15 && departureDate.getHours() < 18);
//     const totalFare = legs.reduce((sum, leg) => sum + getFareForLeg(leg, isPeak), 0);
//     const transferCount = legs.filter(l => l.mode !== 'WALK').length - 1;

//     itineraries.push({
//       legs,
//       totalDurationSec: totalSec,
//       totalFare,
//       departureTime: departureDate,
//       arrivalTime: new Date(departureDate.getTime() + totalSec * 1000),
//       transferCount,
//     });
//   }

//   let allItins = itineraries;
//   if (directItinerary) allItins.push(directItinerary);
//   allItins.sort((a, b) =>
//     tripType === 'fastest' ? a.totalDurationSec - b.totalDurationSec : a.totalFare - b.totalFare
//   );
//   return allItins.slice(0, 5);
// }