const fs = require('fs');
const path = require('path');

const GTFS_DIR = path.join(__dirname, '../assets/gtfs/gautrain');
const OUTPUT_FILE = path.join(__dirname, '../assets/gautrain_data.json');

function readJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(content);
  if (parsed && !Array.isArray(parsed)) {
    if (parsed.stops) return parsed.stops;
    if (parsed.stop_times) return parsed.stop_times;
    if (parsed.trips) return parsed.trips;
    if (parsed.routes) return parsed.routes;
  }
  return parsed;
}

console.log('Reading GTFS files...');
const stops = readJSON(path.join(GTFS_DIR, 'stops.json'));
const stopTimes = readJSON(path.join(GTFS_DIR, 'stop_times.json'));
const trips = readJSON(path.join(GTFS_DIR, 'trips.json'));
const routes = readJSON(path.join(GTFS_DIR, 'routes.json'));

console.log(`Loaded stops: ${stops.length}, stopTimes: ${stopTimes.length}, trips: ${trips.length}, routes: ${routes.length}`);

// ----- Build station list (location_type === 1) -----
const stationRecords = stops.filter(s => s.location_type === 1);
const stations = stationRecords.map(s => ({
  id: s.stop_id,
  name: s.stop_name.replace(' Gautrain Station', '').replace(' Station', '').trim(),
  lat: parseFloat(s.stop_lat),
  lon: parseFloat(s.stop_lon),
}));
// Rename "O.R. Tambo Airport" to "OR Tambo" for consistency
stations.forEach(s => { if (s.name === 'O.R. Tambo Airport') s.name = 'OR Tambo'; });
console.log(`Found ${stations.length} stations:`, stations.map(s => s.name).join(', '));

// ----- Map platform stop_id -> station name (only train platforms) -----
const trainPlatformIds = [
  'centurion_platform_ns', 'centurion_platform_sn',
  'hatfield_platform_ns', 'hatfield_platform_sn',
  'marlboro_platform_ew', 'marlboro_platform_ns', 'marlboro_platform_sn', 'marlboro_platform_we',
  'midrand_platform_ns', 'midrand_platform_sn',
  'ortambo_platform_ew', 'ortambo_platform_we',
  'park_platform_ns', 'park_platform_sn',
  'pretoria_platform_ns', 'pretoria_platform_sn',
  'rhodesfield_platform_ew', 'rhodesfield_platform_we',
  'rosebank_platform_ns', 'rosebank_platform_sn',
  'sandton_platform_ew', 'sandton_platform_ns', 'sandton_platform_sn', 'sandton_platform_we'
];
const platformToStation = {};
trainPlatformIds.forEach(pid => {
  // Extract station name from prefix
  let stationName = pid.split('_')[0];
  if (stationName === 'ortambo') stationName = 'OR Tambo';
  else stationName = stationName.charAt(0).toUpperCase() + stationName.slice(1);
  platformToStation[pid] = stationName;
});
console.log(`Mapped ${Object.keys(platformToStation).length} platforms to stations`);

// ----- Group stop_times by trip_id and sort -----
const tripStopTimes = {};
stopTimes.forEach(st => {
  if (!tripStopTimes[st.trip_id]) tripStopTimes[st.trip_id] = [];
  const [h,m,sec] = st.arrival_time.split(':').map(Number);
  const seconds = h*3600 + m*60 + (sec||0);
  tripStopTimes[st.trip_id].push({
    stop_id: st.stop_id,
    seconds,
    stop_sequence: parseInt(st.stop_sequence, 10)
  });
});
for (let tripId in tripStopTimes) {
  tripStopTimes[tripId].sort((a,b) => a.stop_sequence - b.stop_sequence);
}

// ----- Identify train trips (route_type == 2) -----
const trainRouteIds = routes.filter(r => r.route_type === 2).map(r => r.route_id);
const trainTripIds = trips.filter(t => trainRouteIds.includes(t.route_id)).map(t => t.trip_id);
console.log(`Found ${trainTripIds.length} train trips`);

// ----- Build travel time matrix (only using train platforms) -----
const travelTimeMatrix = {};
trainTripIds.forEach(tripId => {
  const stopsInTrip = tripStopTimes[tripId];
  if (!stopsInTrip) return;
  for (let i = 0; i < stopsInTrip.length - 1; i++) {
    const fromStop = stopsInTrip[i];
    const toStop = stopsInTrip[i+1];
    const fromStation = platformToStation[fromStop.stop_id];
    const toStation = platformToStation[toStop.stop_id];
    if (fromStation && toStation && fromStation !== toStation) {
      const durationSec = toStop.seconds - fromStop.seconds;
      if (durationSec > 0) {
        const durationMin = Math.round(durationSec / 60);
        const key = `${fromStation},${toStation}`;
        if (!travelTimeMatrix[key] || durationMin < travelTimeMatrix[key]) {
          travelTimeMatrix[key] = durationMin;
        }
      }
    }
  }
});
// Add reverse directions
Object.keys(travelTimeMatrix).forEach(key => {
  const [from, to] = key.split(',');
  const revKey = `${to},${from}`;
  if (!travelTimeMatrix[revKey]) {
    travelTimeMatrix[revKey] = travelTimeMatrix[key];
  }
});
console.log(`Built travel time matrix with ${Object.keys(travelTimeMatrix).length} pairs`);

// ----- Manually add missing connections for Park station (since it has no stop_times) -----
// Order of stations on North-South line:
const northSouthOrder = ['Hatfield', 'Pretoria', 'Centurion', 'Midrand', 'Marlboro', 'Sandton', 'Rosebank', 'Park'];
// Compute adjacent times from existing matrix
const adjTimes = {};
for (let i = 0; i < northSouthOrder.length - 1; i++) {
  const a = northSouthOrder[i];
  const b = northSouthOrder[i+1];
  const key = `${a},${b}`;
  if (travelTimeMatrix[key]) {
    adjTimes[`${a}-${b}`] = travelTimeMatrix[key];
  } else {
    // Fallback to known times from your earlier data: Hatfield-Pretoria 7, Pretoria-Centurion 7, etc.
    if (a === 'Hatfield' && b === 'Pretoria') adjTimes[`${a}-${b}`] = 7;
    else if (a === 'Pretoria' && b === 'Centurion') adjTimes[`${a}-${b}`] = 7;
    else if (a === 'Centurion' && b === 'Midrand') adjTimes[`${a}-${b}`] = 9;
    else if (a === 'Midrand' && b === 'Marlboro') adjTimes[`${a}-${b}`] = 6;
    else if (a === 'Marlboro' && b === 'Sandton') adjTimes[`${a}-${b}`] = 5;
    else if (a === 'Sandton' && b === 'Rosebank') adjTimes[`${a}-${b}`] = 4;
    else if (a === 'Rosebank' && b === 'Park') adjTimes[`${a}-${b}`] = 4;
  }
}
// Now compute all missing pairs involving Park by summing along the path
for (let i = 0; i < northSouthOrder.length; i++) {
  for (let j = i+1; j < northSouthOrder.length; j++) {
    const from = northSouthOrder[i];
    const to = northSouthOrder[j];
    const key = `${from},${to}`;
    if (!travelTimeMatrix[key]) {
      let total = 0;
      for (let k = i; k < j; k++) {
        const seg = `${northSouthOrder[k]}-${northSouthOrder[k+1]}`;
        total += adjTimes[seg] || 0;
      }
      if (total > 0) {
        travelTimeMatrix[key] = total;
        travelTimeMatrix[`${to},${from}`] = total;
      }
    }
  }
}
console.log(`Full travel time matrix size: ${Object.keys(travelTimeMatrix).length}`);

// ----- Build departures timetable (only for stations that have stop_times) -----
const tripDirection = {};
trainTripIds.forEach(tripId => {
  const stopsInTrip = tripStopTimes[tripId];
  if (!stopsInTrip || stopsInTrip.length < 2) return;
  const firstStation = platformToStation[stopsInTrip[0].stop_id];
  const lastStation = platformToStation[stopsInTrip[stopsInTrip.length-1].stop_id];
  if (!firstStation || !lastStation) return;
  const northStations = ['Hatfield','Pretoria','Centurion','Midrand','Marlboro','Sandton','Rosebank','Park'];
  let direction = '';
  if (northStations.includes(firstStation) && northStations.includes(lastStation)) {
    const firstIdx = northStations.indexOf(firstStation);
    const lastIdx = northStations.indexOf(lastStation);
    direction = lastIdx > firstIdx ? 'South' : 'North';
  } else if ((firstStation === 'Sandton' && lastStation === 'OR Tambo') ||
             (firstStation === 'Marlboro' && lastStation === 'Rhodesfield')) {
    direction = 'East';
  } else if ((firstStation === 'OR Tambo' && lastStation === 'Sandton') ||
             (firstStation === 'Rhodesfield' && lastStation === 'Marlboro')) {
    direction = 'West';
  }
  if (direction) tripDirection[tripId] = direction;
});

const departures = {};
trainTripIds.forEach(tripId => {
  const stopsInTrip = tripStopTimes[tripId];
  const direction = tripDirection[tripId];
  if (!direction) return;
  for (let stop of stopsInTrip) {
    const stationName = platformToStation[stop.stop_id];
    if (stationName) {
      if (!departures[stationName]) departures[stationName] = {};
      if (!departures[stationName][direction]) departures[stationName][direction] = new Set();
      const timeStr = new Date(stop.seconds * 1000).toISOString().substr(11, 5);
      departures[stationName][direction].add(timeStr);
    }
  }
});
// Convert sets to sorted arrays
for (let stationName in departures) {
  for (let dir in departures[stationName]) {
    departures[stationName][dir] = Array.from(departures[stationName][dir]).sort();
  }
}
// Add Park departures manually (since no stop_times exist) – use generic headway every 20 min from 5:30 to 20:30
const parkDepartures = [];
for (let hour = 5; hour <= 20; hour++) {
  let startMin = (hour === 5) ? 30 : 0;
  let endMin = (hour === 20) ? 30 : 60;
  for (let min = startMin; min < endMin; min += 20) {
    const timeStr = `${hour.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`;
    parkDepartures.push(timeStr);
  }
}
departures['Park'] = {
  North: parkDepartures,
  South: parkDepartures
};
console.log(`Built departures for ${Object.keys(departures).length} stations`);

// ----- Write output -----
const jsonOutput = {
  stations: stations,
  travelTimeMatrix: travelTimeMatrix,
  departures: departures
};
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(jsonOutput, null, 2));
console.log(`Generated ${OUTPUT_FILE}`);