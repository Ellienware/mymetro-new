// scripts/generateReaVayaData.js
const fs = require('fs');
const path = require('path');

const GTFS_DIR = path.join(__dirname, '../assets/gtfs/rea-vaya');
const OUTPUT_FILE = path.join(__dirname, '../assets/reavaya_data.json');

function readJSON(file) {
  const content = fs.readFileSync(path.join(GTFS_DIR, file), 'utf8');
  return JSON.parse(content);
}

const stops = readJSON('stops.json');
const stopTimes = readJSON('stop_times.json');
const trips = readJSON('trips.json');
const routes = readJSON('routes.json');
const frequencies = readJSON('frequencies.json');

// 1. Build frequency map
const freqMap = {};
frequencies.forEach(f => {
  freqMap[f.trip_id] = {
    start_time: f.start_time,
    end_time: f.end_time,
    headway_secs: parseInt(f.headway_secs, 10)
  };
});

// 2. Group stop_times by trip_id, sort by stop_sequence
const tripStopTimes = {};
stopTimes.forEach(st => {
  if (!tripStopTimes[st.trip_id]) tripStopTimes[st.trip_id] = [];
  tripStopTimes[st.trip_id].push({
    stop_id: st.stop_id,
    arrival_time: st.arrival_time,
    departure_time: st.departure_time,
    stop_sequence: parseInt(st.stop_sequence, 10)
  });
});
for (let tid in tripStopTimes) {
  tripStopTimes[tid].sort((a,b) => a.stop_sequence - b.stop_sequence);
}

// 3. For each route, pick a representative trip (first one) to get stop list
const routeDetails = {};
routes.forEach(route => {
  const routeId = route.route_id;
  const tripsForRoute = trips.filter(t => t.route_id === routeId);
  if (tripsForRoute.length === 0) return;
  const firstTrip = tripsForRoute[0];
  const sts = tripStopTimes[firstTrip.trip_id];
  if (!sts) return;
  const stopIds = sts.map(st => st.stop_id);
  const orderedStops = stopIds.map(id => stops.find(s => s.stop_id === id)).filter(s => s);
  const freq = freqMap[firstTrip.trip_id];
  routeDetails[routeId] = {
    route: {
      id: routeId,
      short_name: route.route_short_name,
      long_name: route.route_long_name,
    },
    stops: orderedStops.map(s => ({
      id: s.stop_id,
      name: s.stop_name,
      lat: parseFloat(s.stop_lat),
      lon: parseFloat(s.stop_lon)
    })),
    stopTimes: sts.map(st => ({
      stop_id: st.stop_id,
      arrival_time: st.arrival_time,
      departure_time: st.departure_time,
      stop_sequence: st.stop_sequence
    })),
    frequency: freq ? {
      start_time: freq.start_time,
      end_time: freq.end_time,
      headway_minutes: Math.round(freq.headway_secs / 60)
    } : null
  };
});

// 4. Build a global stop list (unique)
const allStops = {};
Object.values(routeDetails).forEach(rd => {
  rd.stops.forEach(s => { allStops[s.id] = s; });
});
const uniqueStops = Object.values(allStops);

// 5. Build travel time matrix (simplified: from stop_times of any trip)
const travelTimeMatrix = {};
Object.values(tripStopTimes).forEach(sts => {
  for (let i = 0; i < sts.length - 1; i++) {
    const fromId = sts[i].stop_id;
    const toId = sts[i+1].stop_id;
    const fromStop = allStops[fromId];
    const toStop = allStops[toId];
    if (fromStop && toStop) {
      const fromName = fromStop.name;
      const toName = toStop.name;
      const arrival = sts[i+1].arrival_time;
      const departure = sts[i].departure_time;
      const [h1,m1,s1] = departure.split(':').map(Number);
      const [h2,m2,s2] = arrival.split(':').map(Number);
      const minutes = (h2*60+m2) - (h1*60+m1);
      if (minutes > 0) {
        const key = `${fromName},${toName}`;
        if (!travelTimeMatrix[key] || minutes < travelTimeMatrix[key]) {
          travelTimeMatrix[key] = minutes;
        }
      }
    }
  }
});
// Add reverse directions
Object.keys(travelTimeMatrix).forEach(key => {
  const [from, to] = key.split(',');
  const rev = `${to},${from}`;
  if (!travelTimeMatrix[rev]) travelTimeMatrix[rev] = travelTimeMatrix[key];
});

// 6. Write output
const output = {
  stops: uniqueStops,
  travelTimeMatrix,
  routeDetails
};
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
console.log(`Generated ${OUTPUT_FILE}`);