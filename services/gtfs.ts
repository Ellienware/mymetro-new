import stopsRaw from '../assets/gtfs/gautrain/stops.json';
import tripsRaw from '../assets/gtfs/gautrain/trips.json';
import stopTimesRaw from '../assets/gtfs/gautrain/stop_times.json';
import shapesRaw from '../assets/gtfs/gautrain/shapes.json';
import routesRaw from '../assets/gtfs/gautrain/routes.json';
import frequenciesRaw from '../assets/gtfs/gautrain/frequencies.json';
import calendarRaw from '../assets/gtfs/gautrain/calendar.json';
import {
  GTFSStop,
  GTFSTrip,
  GTFSStopTime,
  GTFSRoute,
  GTFSFrequency,
  GTFSCalendar,
} from '../types';

// ===== Map raw data to proper types =====
export const stops: GTFSStop[] = stopsRaw.map((item: any) => ({
  stop_id: item.stop_id,
  stop_name: item.stop_name,
  stop_lat: item.stop_lat,
  stop_lon: item.stop_lon,
  location_type: item.location_type as 0 | 1,
  parent_station: item.parent_station ?? undefined,
  wheelchair_boarding: item.wheelchair_boarding ?? undefined,
  stop_code: item.stop_code ?? undefined,
}));

export const trips: GTFSTrip[] = tripsRaw.map((item: any) => ({
  trip_id: item.trip_id,
  route_id: item.route_id,
  service_id: item.service_id,
  trip_headsign: item.trip_headsign,
  direction_id: item.direction_id?.toString() ?? '0',
  shape_id: item.shape_id,
}));

export const stopTimes: GTFSStopTime[] = stopTimesRaw.map((item: any) => ({
  trip_id: item.trip_id,
  arrival_time: item.arrival_time,
  departure_time: item.departure_time,
  stop_id: item.stop_id,
  stop_sequence: item.stop_sequence,
}));

export const shapes: any[] = shapesRaw;

export const routes: GTFSRoute[] = routesRaw.map((item: any) => ({
  route_id: item.route_id,
  route_short_name: item.route_short_name,
  route_long_name: item.route_long_name,
  route_type: item.route_type as 2 | 3,
  route_color: item.route_color,
  route_text_color: item.route_text_color,
}));

export const frequencies: GTFSFrequency[] = frequenciesRaw.map((item: any) => ({
  trip_id: item.trip_id,
  start_time: item.start_time,
  end_time: item.end_time,
  headway_secs: item.headway_secs,
}));

export const calendar: GTFSCalendar[] = calendarRaw.map((item: any) => ({
  service_id: item.service_id,
  monday: item.monday as 0 | 1,
  tuesday: item.tuesday as 0 | 1,
  wednesday: item.wednesday as 0 | 1,
  thursday: item.thursday as 0 | 1,
  friday: item.friday as 0 | 1,
  saturday: item.saturday as 0 | 1,
  sunday: item.sunday as 0 | 1,
  start_date: item.start_date.toString(),
  end_date: item.end_date.toString(),
}));

// ===== Helper functions (unchanged) =====
export const getRouteById = (routeId: string): GTFSRoute | undefined =>
  routes.find(r => r.route_id === routeId);

export const getTripsByRoute = (routeId: string): GTFSTrip[] =>
  trips.filter(t => t.route_id === routeId);

export const getStopTimesForTrip = (tripId: string): GTFSStopTime[] =>
  stopTimes.filter(st => st.trip_id === tripId).sort((a, b) => a.stop_sequence - b.stop_sequence);

export const getStopById = (stopId: string): GTFSStop | undefined =>
  stops.find(s => s.stop_id === stopId);

export const getShapeById = (shapeId: string): { latitude: number; longitude: number }[] =>
  shapes
    .filter(s => s.shape_id === shapeId)
    .sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence)
    .map(p => ({ latitude: p.shape_pt_lat, longitude: p.shape_pt_lon }));

const timeToSeconds = (time: string): number => {
  const [h, m, s] = time.split(':').map(Number);
  return h * 3600 + m * 60 + s;
};

export const isTripActiveOnDay = (trip: GTFSTrip, dayOfWeek: number): boolean => {
  const cal = calendar.find(c => c.service_id === trip.service_id);
  if (!cal) return false;
  switch (dayOfWeek) {
    case 1: return cal.monday === 1;
    case 2: return cal.tuesday === 1;
    case 3: return cal.wednesday === 1;
    case 4: return cal.thursday === 1;
    case 5: return cal.friday === 1;
    case 6: return cal.saturday === 1;
    case 7: return cal.sunday === 1;
    default: return false;
  }
};

export const getNextDepartures = (
  stopId: string,
  dayOfWeek: number,
  currentTime: string
): Array<{ trip: GTFSTrip; departureTime: string; route: GTFSRoute }> => {
  const timesForStop = stopTimes.filter(st => st.stop_id === stopId);
  const nowSec = timeToSeconds(currentTime);
  const departures: Array<{ trip: GTFSTrip; departureTime: string; route: GTFSRoute }> = [];

  for (const st of timesForStop) {
    const trip = trips.find(t => t.trip_id === st.trip_id);
    if (!trip) continue;
    if (!isTripActiveOnDay(trip, dayOfWeek)) continue;
    const route = getRouteById(trip.route_id);
    if (!route) continue;
    const depSec = timeToSeconds(st.departure_time);
    if (depSec > nowSec) {
      departures.push({ trip, departureTime: st.departure_time, route });
    }
  }

  return departures.sort((a, b) => timeToSeconds(a.departureTime) - timeToSeconds(b.departureTime)).slice(0, 20);
};

export const getRoutesByType = (type: 2 | 3): GTFSRoute[] =>
  routes.filter(r => r.route_type === type);