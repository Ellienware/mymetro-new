const fs = require('fs');
const path = require('path');

const SERVICE_DIR = path.join(__dirname, 'services', 'bus');   // ← changed to 'bus'
const OUTPUT_DIR = path.join(__dirname, 'gtfs_rea_vaya');

// Helper: parse routes.txt (from your extraction)
function parseRoutesTxt(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sections = content.split('---').filter(s => s.trim());
  const routes = [];
  for (const section of sections) {
    const lines = section.trim().split('\n');
    const route = {};
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        const val = valueParts.join(':').trim();
        if (key === 'Stop order (OSM node IDs)') {
          route.stops = val.split(',').map(s => s.trim());
        } else {
          route[key.trim().toLowerCase().replace(/ /g, '_')] = val;
        }
      }
    }
    if (route.route_id && route.stops) routes.push(route);
  }
  return routes;
}

// Helper: parse stops.txt
function parseStopsTxt(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sections = content.split('---').filter(s => s.trim());
  const stops = [];
  for (const section of sections) {
    const lines = section.trim().split('\n');
    const stop = {};
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        const val = valueParts.join(':').trim();
        if (key === 'Coordinates') {
          const [lat, lng] = val.split(',').map(Number);
          stop.stop_lat = lat;
          stop.stop_lon = lng;
        } else if (key === 'Stop ID') {
          stop.stop_id = val;
        } else if (key === 'Name') {
          stop.stop_name = val;
        }
      }
    }
    if (stop.stop_id && stop.stop_name) stops.push(stop);
  }
  return stops;
}

// Write a CSV file
function writeCSV(filePath, headers, rows) {
  const headerLine = headers.join(',') + '\n';
  const rowLines = rows.map(row => headers.map(h => row[h] ?? '').join(',')).join('\n');
  fs.writeFileSync(filePath, headerLine + rowLines);
}

// Generate realistic stop_times: assume 20 km/h average speed, compute travel time between stops
function computeStopTimes(route, stopsMap) {
  const stopTimes = [];
  let cumulativeSeconds = 6 * 3600; // start at 06:00 (dummy, will be shifted later)
  let sequence = 0;
  for (let i = 0; i < route.stops.length; i++) {
    const stopId = route.stops[i];
    const stop = stopsMap[stopId];
    if (!stop) continue;
    const timeStr = new Date(cumulativeSeconds * 1000).toISOString().substr(11, 8);
    stopTimes.push({
      stop_id: stopId,
      arrival_time: timeStr,
      departure_time: timeStr,
      stop_sequence: sequence,
    });
    // Compute time to next stop
    if (i < route.stops.length - 1) {
      const nextStop = stopsMap[route.stops[i + 1]];
      if (stop && nextStop) {
        const distance = Math.sqrt(
          Math.pow(stop.stop_lat - nextStop.stop_lat, 2) +
          Math.pow(stop.stop_lon - nextStop.stop_lon, 2)
        ) * 111; // approx km (rough, but fine)
        const travelSeconds = (distance / 20) * 3600; // 20 km/h
        cumulativeSeconds += Math.max(60, travelSeconds); // at least 1 minute
      } else {
        cumulativeSeconds += 60;
      }
    }
    sequence++;
  }
  return stopTimes;
}

// Main
if (!fs.existsSync(SERVICE_DIR)) {
  console.error(`Bus service directory not found: ${SERVICE_DIR}`);
  process.exit(1);
}

const routes = parseRoutesTxt(path.join(SERVICE_DIR, 'routes.txt'));
const stops = parseStopsTxt(path.join(SERVICE_DIR, 'stops.txt'));

if (routes.length === 0 || stops.length === 0) {
  console.error('No routes or stops found for Rea Vaya (bus)');
  process.exit(1);
}

// Build stops map
const stopsMap = {};
for (const stop of stops) {
  stopsMap[stop.stop_id] = stop;
}

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// 1. routes.txt
const routesRows = routes.map(route => ({
  route_id: route.route_id,
  route_short_name: route.name?.split(' ')[0] || route.route_id,
  route_long_name: route.name,
  route_type: 3, // bus
}));
writeCSV(path.join(OUTPUT_DIR, 'routes.txt'), ['route_id', 'route_short_name', 'route_long_name', 'route_type'], routesRows);

// 2. stops.txt
const stopsRows = stops.map(stop => ({
  stop_id: stop.stop_id,
  stop_name: stop.stop_name,
  stop_lat: stop.stop_lat,
  stop_lon: stop.stop_lon,
}));
writeCSV(path.join(OUTPUT_DIR, 'stops.txt'), ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'], stopsRows);

// 3. calendar.txt – define service periods
const calendars = [
  { service_id: 'weekday_peak1',   start_date: '20240101', end_date: '20251231', monday:1, tuesday:1, wednesday:1, thursday:1, friday:1, saturday:0, sunday:0 },
  { service_id: 'weekday_offpeak', start_date: '20240101', end_date: '20251231', monday:1, tuesday:1, wednesday:1, thursday:1, friday:1, saturday:0, sunday:0 },
  { service_id: 'weekday_peak2',   start_date: '20240101', end_date: '20251231', monday:1, tuesday:1, wednesday:1, thursday:1, friday:1, saturday:0, sunday:0 },
  { service_id: 'saturday',        start_date: '20240101', end_date: '20251231', monday:0, tuesday:0, wednesday:0, thursday:0, friday:0, saturday:1, sunday:0 },
  { service_id: 'sunday',          start_date: '20240101', end_date: '20251231', monday:0, tuesday:0, wednesday:0, thursday:0, friday:0, saturday:0, sunday:1 },
];
writeCSV(path.join(OUTPUT_DIR, 'calendar.txt'), ['service_id','monday','tuesday','wednesday','thursday','friday','saturday','sunday','start_date','end_date'], calendars);

// 4. trips.txt – one trip per route per service period
const trips = [];
const tripRows = [];
for (const route of routes) {
  for (const cal of calendars) {
    const tripId = `${route.route_id}_${cal.service_id}`;
    trips.push({ route, tripId, serviceId: cal.service_id });
    tripRows.push({
      route_id: route.route_id,
      service_id: cal.service_id,
      trip_id: tripId,
    });
  }
}
writeCSV(path.join(OUTPUT_DIR, 'trips.txt'), ['route_id', 'service_id', 'trip_id'], tripRows);

// 5. stop_times.txt – compute once per route (same for all trips of that route)
const allStopTimes = [];
for (const { route, tripId } of trips) {
  const stopTimes = computeStopTimes(route, stopsMap);
  for (const st of stopTimes) {
    allStopTimes.push({
      trip_id: tripId,
      arrival_time: st.arrival_time,
      departure_time: st.departure_time,
      stop_id: st.stop_id,
      stop_sequence: st.stop_sequence,
    });
  }
}
writeCSV(path.join(OUTPUT_DIR, 'stop_times.txt'), ['trip_id','arrival_time','departure_time','stop_id','stop_sequence'], allStopTimes);

// 6. frequencies.txt – specify headways for each service period
const frequencies = [];
for (const route of routes) {
  // Weekday peak (05:00-08:30)
  frequencies.push({
    trip_id: `${route.route_id}_weekday_peak1`,
    start_time: '05:00:00',
    end_time: '08:30:00',
    headway_secs: 5 * 60,
  });
  // Weekday off-peak (08:30-15:00)
  frequencies.push({
    trip_id: `${route.route_id}_weekday_offpeak`,
    start_time: '08:30:00',
    end_time: '15:00:00',
    headway_secs: 15 * 60,
  });
  // Weekday peak 2 (15:00-21:00)
  frequencies.push({
    trip_id: `${route.route_id}_weekday_peak2`,
    start_time: '15:00:00',
    end_time: '21:00:00',
    headway_secs: 5 * 60,
  });
  // Saturday (05:00-19:00)
  frequencies.push({
    trip_id: `${route.route_id}_saturday`,
    start_time: '05:00:00',
    end_time: '19:00:00',
    headway_secs: 30 * 60,
  });
  // Sunday (06:00-19:00)
  frequencies.push({
    trip_id: `${route.route_id}_sunday`,
    start_time: '06:00:00',
    end_time: '19:00:00',
    headway_secs: 30 * 60,
  });
}
writeCSV(path.join(OUTPUT_DIR, 'frequencies.txt'), ['trip_id','start_time','end_time','headway_secs'], frequencies);

console.log(`✅ GTFS for Rea Vaya generated in ${OUTPUT_DIR}`);