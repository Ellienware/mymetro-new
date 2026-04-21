const fs = require('fs');
const path = require('path');

const SERVICES_DIR = path.join(__dirname, 'services');
const OUTPUT_DIR = path.join(__dirname, 'gtfs_output');

// Define a dummy calendar: service every day of the week
const DUMMY_CALENDAR = {
  service_id: 'dummy',
  monday: 1,
  tuesday: 1,
  wednesday: 1,
  thursday: 1,
  friday: 1,
  saturday: 1,
  sunday: 1,
  start_date: '20240101',
  end_date: '20251231'
};

// Helper: parse a routes.txt file back into objects
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

// Helper: parse stops.txt back into objects
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
        } else if (key === 'Lines serving this stop') {
          stop.lines = val;
        }
      }
    }
    if (stop.stop_id && stop.stop_name) stops.push(stop);
  }
  return stops;
}

function writeGTFSFiles(serviceName, routes, stops, outputDir) {
  const serviceOutput = path.join(outputDir, serviceName);
  if (!fs.existsSync(serviceOutput)) fs.mkdirSync(serviceOutput, { recursive: true });

  // --- routes.txt ---
  let routesCSV = 'route_id,route_short_name,route_long_name,route_type\n';
  for (const route of routes) {
    const shortName = route.name?.split(' ')[0] || route.route_id;
    routesCSV += `${route.route_id},${shortName},${route.name},3\n`; // route_type 3 = bus (or adjust)
  }
  fs.writeFileSync(path.join(serviceOutput, 'routes.txt'), routesCSV);

  // --- stops.txt ---
  let stopsCSV = 'stop_id,stop_name,stop_lat,stop_lon\n';
  for (const stop of stops) {
    stopsCSV += `${stop.stop_id},${stop.stop_name},${stop.stop_lat},${stop.stop_lon}\n`;
  }
  fs.writeFileSync(path.join(serviceOutput, 'stops.txt'), stopsCSV);

  // --- calendar.txt ---
  let calendarCSV = 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n';
  calendarCSV += `${DUMMY_CALENDAR.service_id},${DUMMY_CALENDAR.monday},${DUMMY_CALENDAR.tuesday},${DUMMY_CALENDAR.wednesday},${DUMMY_CALENDAR.thursday},${DUMMY_CALENDAR.friday},${DUMMY_CALENDAR.saturday},${DUMMY_CALENDAR.sunday},${DUMMY_CALENDAR.start_date},${DUMMY_CALENDAR.end_date}\n`;
  fs.writeFileSync(path.join(serviceOutput, 'calendar.txt'), calendarCSV);

  // --- trips.txt & stop_times.txt ---
  let tripsCSV = 'route_id,service_id,trip_id\n';
  let stopTimesCSV = 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n';

  for (const route of routes) {
    const tripId = `${route.route_id}_dummy`;
    tripsCSV += `${route.route_id},${DUMMY_CALENDAR.service_id},${tripId}\n`;

    // Generate dummy times: start at 06:00:00, add 1 minute per stop
    let currentTime = 6 * 3600; // seconds
    let sequence = 0;
    for (const stopId of route.stops) {
      const hours = Math.floor(currentTime / 3600);
      const minutes = Math.floor((currentTime % 3600) / 60);
      const seconds = currentTime % 60;
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      stopTimesCSV += `${tripId},${timeStr},${timeStr},${stopId},${sequence}\n`;
      currentTime += 60; // 1 minute between stops
      sequence++;
    }
  }
  fs.writeFileSync(path.join(serviceOutput, 'trips.txt'), tripsCSV);
  fs.writeFileSync(path.join(serviceOutput, 'stop_times.txt'), stopTimesCSV);

  console.log(`✅ GTFS generated for ${serviceName} in ${serviceOutput}`);
}

// Main
if (!fs.existsSync(SERVICES_DIR)) {
  console.error(`Services directory not found: ${SERVICES_DIR}`);
  process.exit(1);
}

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const services = fs.readdirSync(SERVICES_DIR);

for (const service of services) {
  // Skip Gautrain if you have real GTFS already – adjust condition as needed
  if (service === 'Gautrain') {
    console.log(`⏭️ Skipping ${service} (use real GTFS instead)`);
    continue;
  }

  const routesPath = path.join(SERVICES_DIR, service, 'routes.txt');
  const stopsPath = path.join(SERVICES_DIR, service, 'stops.txt');

  if (!fs.existsSync(routesPath) || !fs.existsSync(stopsPath)) {
    console.log(`⚠️ Skipping ${service}: missing routes.txt or stops.txt`);
    continue;
  }

  const routes = parseRoutesTxt(routesPath);
  const stops = parseStopsTxt(stopsPath);

  if (routes.length === 0 || stops.length === 0) {
    console.log(`⚠️ Skipping ${service}: no valid routes or stops`);
    continue;
  }

  writeGTFSFiles(service, routes, stops, OUTPUT_DIR);
}

console.log('🎉 All GTFS feeds generated in ./gtfs_output/');