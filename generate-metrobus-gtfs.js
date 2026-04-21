const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const fetch = require('node-fetch');

// ========== 1. Metrobus route data (from your table) ==========
const metrobusRoutesRaw = [
  { number: '16', description: 'Auckland Park to Sydenham (UJ Scholars)', via: 'Sydenham( UJ Scholars)', distance_km: 12.1, duration_min: 19 },
  { number: '421D', description: 'Bellevue East to Sunninghill', via: 'Sunninghill', distance_km: 21.4, duration_min: 27 },
  { number: '421F', description: 'Bellevue East to Fairlands', via: 'Fairlands', distance_km: 26.9, duration_min: 32 },
  { number: '421G', description: 'Bellevue East to Fourways Mall', via: 'Fourways Mall', distance_km: 28.7, duration_min: 28 },
  { number: '421R', description: 'Bellevue East to Strydom Park', via: 'Strydom Park', distance_km: 33.4, duration_min: 31 },
  { number: '421H', description: 'Bellevue East to Honeydew via Laser Park', via: 'Honeydew', distance_km: 36.9, duration_min: 42 },
  { number: '42', description: 'Braamfontein to Elands Park', via: 'Elands Park', distance_km: 12.2, duration_min: 15 },
  { number: '45', description: 'Braamfontein to Marist Brothers via Linmeyer', via: 'Marist Brothers', distance_km: 12.2, duration_min: 18 },
  { number: '32C', description: 'Braamfontein to Bedford Plaza', via: 'Bedford Plaza', distance_km: 16.6, duration_min: 19 },
  { number: '57B', description: 'Braamfontein to Naturena', via: 'Naturena', distance_km: 16.7, duration_min: 18 },
  { number: '56', description: 'Braamfontein to Mayfield Park via Kibler Park', via: 'Mayfield Park', distance_km: 20.8, duration_min: 22 },
  { number: '436', description: 'Davidsonville to Sunninghill', via: 'Sunninghill', distance_km: 34.5, duration_min: 37 },
  { number: '18', description: 'Foresthill to JHB Hospital', via: 'JHB Hospital', distance_km: 46, duration_min: 36 },
  { number: '518D', description: 'Foresthill to Sunninghill via Gandhi square', via: 'Sunninghill', distance_km: 78.6, duration_min: 68 },
  { number: '415A', description: 'Gandhi square to Makro centre', via: 'Makro centre', distance_km: 3.6, duration_min: 11 },
  { number: '59', description: 'Gandhi square to Crown mines Ext', via: 'Crown mines Ext', distance_km: 4.8, duration_min: 10 },
  { number: '46A', description: 'Gandhi square to JHB Hospital', via: 'JHB Hospital', distance_km: 6.3, duration_min: 16 },
  { number: '47', description: 'Gandhi square to Townsview', via: 'Townsview', distance_km: 6.7, duration_min: 15 },
  { number: '48', description: 'Gandhi square to Towerby', via: 'Towerby', distance_km: 6.9, duration_min: 14 },
  { number: '55B', description: 'Gandhi square to Evans Park', via: 'Evans Park', distance_km: 8, duration_min: 12 },
  { number: '55A', description: 'Gandhi square to Ridgeway Extention', via: 'Ridgeway Extention', distance_km: 9, duration_min: 14 },
  { number: '42A', description: 'Gandhi square to Elands Park', via: 'Elands Park', distance_km: 9.5, duration_min: 14 },
  { number: '47C', description: 'Gandhi square to the Glen', via: 'the Glen', distance_km: 9.9, duration_min: 17 },
  { number: '47B', description: 'Gandhi square to Bassonia', via: 'Bassonia', distance_km: 11.5, duration_min: 17 },
  { number: '79', description: 'Gandhi square to Parkhurst via Zoo lake', via: 'Parkhurst', distance_km: 11.8, duration_min: 23 },
  { number: '49B', description: 'Gandhi square to Glenvista Extention 4', via: 'Glenvista Extention 5', distance_km: 12.2, duration_min: 21 },
  { number: '01A', description: 'Gandhi square to Parktown North via Oxford Road', via: 'Parktown North', distance_km: 12.7, duration_min: 23 },
  { number: '49C', description: 'Gandhi square to Mulbarton via Liefde en Vrede', via: 'Mulbarton', distance_km: 13.9, duration_min: 20 },
  { number: '13A', description: 'Gandhi square to Glenhazel via Highlands North', via: 'Glenhazel', distance_km: 15.9, duration_min: 23 },
  { number: '4', description: 'Gandhi square to Highlands north via Louis Botha', via: 'Highlands North', distance_km: 16.4, duration_min: 25 },
  { number: '57A', description: 'Gandhi square to Naturena', via: 'Naturena', distance_km: 16.6, duration_min: 21 },
  { number: '13B', description: 'Gandhi square to Lyndhurst via Highlands North', via: 'Lyndhurst', distance_km: 17, duration_min: 25 },
  { number: '71C', description: 'Gandhi square to Fairlands via Berario', via: 'Fairlands', distance_km: 18.5, duration_min: 30 },
  { number: '86B', description: 'Gandhi square to Strydom Park', via: 'Strydom Park', distance_km: 19.3, duration_min: 31 },
  { number: '56A', description: 'Gandhi square to Mayfield Park via Kibler Park', via: 'Mayfield Park', distance_km: 20.8, duration_min: 24 },
  { number: '80A', description: 'Gandhi square to Beverly Gardens', via: 'Beverly Gardens', distance_km: 21.2, duration_min: 34 },
  { number: '6D', description: 'Gandhi square to Woodmead Extention', via: 'Woodmead Extention', distance_km: 23.5, duration_min: 25 },
  { number: '417', description: 'Gandhi square to Davidsonville', via: 'Davidsonville', distance_km: 23.6, duration_min: 34 },
  { number: '82A', description: 'Gandhi square to Ferndale Extention via Randburg', via: 'Ferndale Extention', distance_km: 23.6, duration_min: 37 },
  { number: '13C', description: 'Gandhi square to Kew via Highlands North', via: 'Kew', distance_km: 24.5, duration_min: 34 },
  { number: '414', description: 'Gandhi square to Lindhaven', via: 'Lindhaven', distance_km: 24.7, duration_min: 36 },
  { number: '15A', description: 'Gandhi square to Lombardy East via Sandringham', via: 'Lombardy East', distance_km: 25, duration_min: 29 },
  { number: '412', description: 'Gandhi square to Witpoortjie', via: 'Witpoortjie', distance_km: 25.9, duration_min: 35 },
  { number: '9', description: 'Gandhi square to Linbro Park', via: 'Linbro Park', distance_km: 26.7, duration_min: 26 },
  { number: '415', description: 'Gandhi square to Weltervreden Park', via: 'Weltervreden Park', distance_km: 26.7, duration_min: 29 },
  { number: '86A', description: 'Gandhi square to Kya Sands via Strydom Park', via: 'Kya Sands', distance_km: 28.2, duration_min: 46 },
  { number: '6A', description: 'Gandhi square to Leewkop Prison', via: 'Leewkop Prison', distance_km: 28.9, duration_min: 28 },
  { number: '15D', description: 'Gandhi square to Lombardy West via Kew', via: 'Lombardy West', distance_km: 29.4, duration_min: 28 },
  { number: '413', description: 'Gandhi square to Roodekrans', via: 'Roodekrans', distance_km: 29.8, duration_min: 39 },
  { number: '88A', description: 'Gandhi square to Honeydew via Laser Park', via: 'Honeydew', distance_km: 31.8, duration_min: 38 },
  { number: '89B', description: 'Gandhi square to Northgate', via: 'Northgate', distance_km: 33.3, duration_min: 35 },
  { number: '80F', description: 'Gandhi square to Fourways Mall', via: 'Fourways Mall', distance_km: 33.5, duration_min: 30 },
  { number: '86D', description: 'Gandhi square to Northlands Business Park', via: 'Northlands Business Park', distance_km: 34.9, duration_min: 37 },
  { number: '12', description: 'Gandhi square to Lone Hill via Kramerville', via: 'Lone Hill', distance_km: 35.1, duration_min: 41 },
  { number: '7A', description: 'Gandhi square to UTI, Midrand Extention', via: 'UTI, Midrand Extention', distance_km: 37.3, duration_min: 35 },
  { number: '89A', description: 'Gandhi square to Kya Sands via Northgate', via: 'Kya Sands', distance_km: 38.3, duration_min: 43 },
  { number: '80D', description: 'Gandhi square to Dainfern via Fourways', via: 'Dainfern', distance_km: 40.7, duration_min: 45 },
  { number: '7C', description: 'Gandhi square to Airforce Base', via: 'Airforce Base', distance_km: 54.9, duration_min: 45 },
  { number: '7B', description: 'Gandhi square to N1 Military Hospital', via: 'N1 Military Hospital', distance_km: 57.9, duration_min: 46 },
  { number: '89C', description: 'Gandhi square to Noordgang via Northgate', via: 'Noordgang', distance_km: 59.5, duration_min: 58 },
  { number: '7D', description: 'Gandhi square to Arcadia via Pta central', via: 'Arcadia', distance_km: 61.5, duration_min: 54 },
  { number: '265A', description: 'Hillbrow to Elandsfontein', via: 'Elandsfontein', distance_km: 15.1, duration_min: 24 },
  { number: '265', description: 'Hillbrow to Isando', via: 'Isando', distance_km: 19, duration_min: 27 },
  { number: '262', description: 'Hillbrow to OR tambo via Kempton Park', via: 'OR tambo', distance_km: 32.7, duration_min: 44 },
  { number: '49J', description: 'JHB Hospital to Mulbarton via Ext4 & Liefde en Vrede', via: 'Mulbarton', distance_km: 22.4, duration_min: 30 },
  { number: '227', description: 'Judiths Paarl to Crosby', via: 'Crosby', distance_km: 9.6, duration_min: 22 },
  { number: '556E', description: 'Mayfield Park to Megawatt Park via Auckland Park', via: 'Megawatt Park', distance_km: 45.2, duration_min: 51 },
  { number: '522', description: 'Naturena to Randburg mall via Jan Smuts ave', via: 'Randburg Mall', distance_km: 28.5, duration_min: 38 },
  { number: '520', description: 'Naturena to Randburg Mall', via: 'Randburg Mall', distance_km: 33.8, duration_min: 31 },
  { number: '520A', description: 'Naturena to Fourways Mall', via: 'Fourways Mall', distance_km: 36.5, duration_min: 28 },
  { number: '523', description: 'Naturena to fourways Mall via William niicol', via: 'Fourways Mall', distance_km: 39.8, duration_min: 35 },
  { number: '521A', description: 'Naturena to Barlowworld', via: 'Barlowworld', distance_km: 43.5, duration_min: 36 },
  { number: '260A', description: 'Ormondeview to Eastgate via Bezvalley', via: 'Eastgate', distance_km: 19.3, duration_min: 26 },
  { number: '260', description: 'Paarlhoop to Eastgate via Bezvalley', via: 'Eastgate', distance_km: 16.2, duration_min: 25 },
  { number: '551C', description: 'Protea Gardens to Sunninghill via Pimville', via: 'Sunninghill', distance_km: 50.9, duration_min: 55 },
  { number: '551B', description: 'Protea Gardens to Sunninghill', via: 'Sunninghill', distance_km: 54.6, duration_min: 43 },
  { number: '552', description: 'Protea Glen to Fourways Mall', via: 'Fourways Mall', distance_km: 52.1, duration_min: 36 },
  { number: '553', description: 'Protea Glen to Kya Sands via Malibongwe', via: 'Kya Sands', distance_km: 58, duration_min: 55 },
  { number: '551A', description: 'Protea Glen to Sunninghill', via: 'Sunninghill', distance_km: 58.7, duration_min: 44 },
  { number: '551D', description: 'Protea North to Sunninghill', via: 'Sunninghill', distance_km: 57.2, duration_min: 46 },
  { number: '46', description: 'Rosettenville to JHB Hospital', via: 'JHB Hospital', distance_km: 12.2, duration_min: 20 },
  { number: '546D', description: 'Rosettenville to Sunninghill via Gandhi square', via: 'Sunninghill', distance_km: 32.7, duration_min: 42 },
  { number: '55', description: 'Sanlam centre to Meredale via Southgate', via: 'Meredale', distance_km: 31.8, duration_min: 37 },
  { number: '52C', description: 'Sanlam centre to Winchester Hills Ext 3', via: 'Winchester Hills Ext 4', distance_km: 33.7, duration_min: 30 },
  { number: '52B', description: 'Sanlam centre to Winchester Hills', via: 'Winchester Hills', distance_km: 34.8, duration_min: 31 },
  { number: '52', description: 'Sanlam centre to Southgate via Mondeor', via: 'Southgate', distance_km: 36, duration_min: 41 },
  { number: '54A', description: 'Sanlam cenntre to The Glen', via: 'the Glen', distance_km: 39.4, duration_min: 34 },
  { number: '562', description: 'Southgate to OR Tambo int Airport', via: 'OR Tambo int Airport', distance_km: 35.5, duration_min: 28 },
  { number: '10', description: 'Stock Exchange to Melrose Arch', via: 'Melrose Arch', distance_km: 5.9, duration_min: 12 },
  { number: '74', description: 'Stock Exchange to Blairgowrie', via: 'Blairgowrie', distance_km: 6.9, duration_min: 13 },
  { number: '78B', description: 'Stock Exchange to Blairgowrie via Jan Smuts ave', via: 'Blairgowrie', distance_km: 11.9, duration_min: 19 },
  { number: '87A', description: 'Stock Exchange to Glendayson', via: 'Glendayson', distance_km: 16.4, duration_min: 27 },
  { number: '8A', description: 'Stock Exchange to Winston Ridge via Houghton', via: 'Winston Ridge', distance_km: 16.6, duration_min: 23 },
  { number: '5D', description: 'Stock Exchange to Sunninghill via Oxford/Rivonia', via: 'Sunninghill', distance_km: 19.3, duration_min: 33 },
  { number: '87', description: 'Stock Exchange to Glendayson via Bush HILL', via: 'Glendayson', distance_km: 19.4, duration_min: 34 },
  { number: '261', description: 'Stpock Exchange to Edenvale', via: 'Edenvale', distance_km: 19.7, duration_min: 28 },
  { number: '22C', description: 'Stock Exchange to Bedford Plaza', via: 'Bedford Plaza', distance_km: 22, duration_min: 28 },
  { number: '34', description: 'Stock Exchange to Malvern via Jules str', via: 'Malvern', distance_km: 24.9, duration_min: 28 },
  { number: '38', description: 'Stock Exchange to Germiston via Main Reef', via: 'Germiston', distance_km: 32.9, duration_min: 36 },
  { number: '547D', description: 'Townsview to Sunninghill via Gandhi square', via: 'Sunninghill', distance_km: 33.1, duration_min: 43 },
  { number: '33', description: 'Westgate to Bedford Gardens via Sovereign street', via: 'Bedford Gardens', distance_km: 12.6, duration_min: 18 },
  { number: '32A', description: 'Westgate to Bedford Gardens', via: 'Bedford Gardens', distance_km: 14.7, duration_min: 18 },
  { number: '3', description: 'Westgate to Highlands north via Rosebank', via: 'Highlands North', distance_km: 16.1, duration_min: 19 },
  { number: '2', description: 'Westgate to Birnam via Illovo', via: 'Birnam', distance_km: 17.5, duration_min: 28 },
  { number: '83', description: 'Westgate to Malanshof', via: 'Malanshof', distance_km: 17.8, duration_min: 28 },
  { number: '71B', description: 'Westgate to Fairlands via Berario', via: 'Fairlands', distance_km: 18.6, duration_min: 29 },
  { number: '83C', description: 'Westgate to Randpark Ridge', via: 'Randpark Ridge', distance_km: 23.2, duration_min: 23 },
  { number: '85B', description: 'Westgate to JHB North via Randburg centre', via: 'JHB North', distance_km: 25, duration_min: 43 },
  { number: '15F', description: 'Westgate to Longmeadow via Sandringham', via: 'Longmeadow', distance_km: 27.2, duration_min: 32 },
  { number: '84', description: 'Westgate to Honeydew', via: 'Honeydew', distance_km: 27.5, duration_min: 31 },
  { number: '84C', description: 'Westgate to Honeydew via Randpark Ridge', via: 'Honeydew', distance_km: 28.6, duration_min: 33 },
  { number: '82', description: 'Westgate to Ferndale Extention via Randburg', via: 'Ferndale Extention', distance_km: 29.6, duration_min: 33 },
  { number: '80', description: 'Westgate to Beeverly Gardens', via: 'Beeverly Gardens', distance_km: 30.6, duration_min: 31 },
  { number: '85', description: 'Westgate to Johannesburg North', via: 'Johannesburg North', distance_km: 31, duration_min: 32 },
  { number: '15B', description: 'Westgate to Lombardy East via Sandringham', via: 'Lombardy East', distance_km: 51, duration_min: 48 },
  { number: '420', description: 'Westgate Node to Randburg centre', via: 'Randburg centre', distance_km: 17, duration_min: 28 },
  { number: '420A', description: 'Westgate Node to Sunninghill via Cresta', via: 'Sunninghill', distance_km: 37.8, duration_min: 47 },
  { number: '430A', description: 'Westgate Node to Sunninghill via Cresta', via: 'Sunninghill', distance_km: 37.8, duration_min: 47 },
  { number: '421J', description: 'Yeoville to Noordhang via JHB North', via: 'Noordhang', distance_km: 32.5, duration_min: 35 },
  { number: '421K', description: 'Yeoville to Dainfern', via: 'Dainfern', distance_km: 33.4, duration_min: 37 },
  { number: '421I', description: 'Yeoville to Northlands Business Park', via: 'Northlands Business Park', distance_km: 33.5, duration_min: 34 },
  { number: '421N', description: 'Yeoville to Northgate centre', via: 'Northgate centre', distance_km: 35.3, duration_min: 33 }
];

// ========== 2. Geocoding helper (with caching) ==========
const geocodeCache = new Map();

async function geocodePlace(placeName) {
  // Clean up the place name
  let cleanName = placeName.replace(/[()]/g, '').trim();
  if (geocodeCache.has(cleanName)) return geocodeCache.get(cleanName);
  
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanName + ', Johannesburg, South Africa')}&format=json&limit=1`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'myMetroApp/1.0' }
    });
    const data = await response.json();
    if (data && data.length > 0) {
      const coord = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      geocodeCache.set(cleanName, coord);
      console.log(`Geocoded "${cleanName}" → (${coord.lat}, ${coord.lon})`);
      return coord;
    }
  } catch (err) {
    console.warn(`Geocoding failed for "${cleanName}":`, err.message);
  }
  // Fallback to Johannesburg city centre
  const fallback = { lat: -26.195, lon: 28.034 };
  geocodeCache.set(cleanName, fallback);
  console.warn(`Using fallback coordinates for "${cleanName}"`);
  return fallback;
}

// ========== 3. Process routes: extract start, via, end ==========
async function buildRoutes() {
  const routes = [];
  const allStopsMap = new Map(); // stop_id -> stop object

  for (const raw of metrobusRoutesRaw) {
    // Parse description: "Start to End" – some have "via" but the end is after "to"
    const parts = raw.description.split(' to ');
    if (parts.length < 2) {
      console.warn(`Skipping route ${raw.number}: cannot parse description`);
      continue;
    }
    const startName = parts[0].trim();
    const endName = parts[1].split(' via')[0].trim();
    const viaName = raw.via.trim();

    // Geocode start, via, end
    const startCoord = await geocodePlace(startName);
    const viaCoord = await geocodePlace(viaName);
    const endCoord = await geocodePlace(endName);

    const routeId = `METROBUS_${raw.number}`;
    const startStopId = `STOP_${raw.number}_START`;
    const viaStopId = `STOP_${raw.number}_VIA`;
    const endStopId = `STOP_${raw.number}_END`;

    // Add stops to map
    if (!allStopsMap.has(startStopId)) {
      allStopsMap.set(startStopId, {
        stop_id: startStopId,
        stop_name: startName,
        stop_lat: startCoord.lat,
        stop_lon: startCoord.lon,
      });
    }
    if (!allStopsMap.has(viaStopId)) {
      allStopsMap.set(viaStopId, {
        stop_id: viaStopId,
        stop_name: viaName,
        stop_lat: viaCoord.lat,
        stop_lon: viaCoord.lon,
      });
    }
    if (!allStopsMap.has(endStopId)) {
      allStopsMap.set(endStopId, {
        stop_id: endStopId,
        stop_name: endName,
        stop_lat: endCoord.lat,
        stop_lon: endCoord.lon,
      });
    }

    routes.push({
      route_id: routeId,
      route_short_name: raw.number,
      route_long_name: raw.description,
      route_type: 3, // bus
      stops: [startStopId, viaStopId, endStopId],
      duration_min: raw.duration_min,
      distance_km: raw.distance_km,
    });
  }
  return { routes, allStopsMap };
}

// ========== 4. Generate GTFS files ==========
async function generateGTFS() {
  console.log('Building routes and stops...');
  const { routes, allStopsMap } = await buildRoutes();
  const stops = Array.from(allStopsMap.values());

  const OUTPUT_DIR = path.join(__dirname, 'gtfs_metrobus');
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. routes.txt
  const routesWriter = createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, 'routes.txt'),
    header: [
      { id: 'route_id', title: 'route_id' },
      { id: 'route_short_name', title: 'route_short_name' },
      { id: 'route_long_name', title: 'route_long_name' },
      { id: 'route_type', title: 'route_type' },
    ],
  });
  await routesWriter.writeRecords(routes.map(r => ({
    route_id: r.route_id,
    route_short_name: r.route_short_name,
    route_long_name: r.route_long_name,
    route_type: r.route_type,
  })));
  console.log('routes.txt written');

  // 2. stops.txt
  const stopsWriter = createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, 'stops.txt'),
    header: [
      { id: 'stop_id', title: 'stop_id' },
      { id: 'stop_name', title: 'stop_name' },
      { id: 'stop_lat', title: 'stop_lat' },
      { id: 'stop_lon', title: 'stop_lon' },
    ],
  });
  await stopsWriter.writeRecords(stops);
  console.log('stops.txt written');

  // 3. calendar.txt
  const calendar = [
    { service_id: 'weekday', monday:1, tuesday:1, wednesday:1, thursday:1, friday:1, saturday:0, sunday:0, start_date: '20240101', end_date: '20251231' },
    { service_id: 'weekend', monday:0, tuesday:0, wednesday:0, thursday:0, friday:0, saturday:1, sunday:1, start_date: '20240101', end_date: '20251231' },
  ];
  const calendarWriter = createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, 'calendar.txt'),
    header: ['service_id','monday','tuesday','wednesday','thursday','friday','saturday','sunday','start_date','end_date'],
  });
  await calendarWriter.writeRecords(calendar);
  console.log('calendar.txt written');

  // 4. trips.txt
  const trips = [];
  for (const route of routes) {
    for (const cal of calendar) {
      trips.push({
        trip_id: `${route.route_id}_${cal.service_id}`,
        route_id: route.route_id,
        service_id: cal.service_id,
      });
    }
  }
  const tripsWriter = createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, 'trips.txt'),
    header: ['trip_id','route_id','service_id'],
  });
  await tripsWriter.writeRecords(trips);
  console.log('trips.txt written');

  // 5. stop_times.txt
  const stopTimes = [];
  for (const trip of trips) {
    const route = routes.find(r => r.route_id === trip.route_id);
    if (!route) continue;
    const totalSeconds = route.duration_min * 60;
    const numStops = route.stops.length;
    const intervalSeconds = totalSeconds / (numStops - 1);
    let currentSeconds = 6 * 3600; // first departure at 06:00
    for (let i = 0; i < route.stops.length; i++) {
      const timeStr = new Date(currentSeconds * 1000).toISOString().substr(11, 8);
      stopTimes.push({
        trip_id: trip.trip_id,
        arrival_time: timeStr,
        departure_time: timeStr,
        stop_id: route.stops[i],
        stop_sequence: i,
      });
      currentSeconds += intervalSeconds;
    }
  }
  const stopTimesWriter = createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, 'stop_times.txt'),
    header: ['trip_id','arrival_time','departure_time','stop_id','stop_sequence'],
  });
  await stopTimesWriter.writeRecords(stopTimes);
  console.log('stop_times.txt written');

  // 6. frequencies.txt
  const frequencies = [];
  for (const route of routes) {
    // Weekday frequency: every 30 minutes from 05:00 to 21:00
    frequencies.push({
      trip_id: `${route.route_id}_weekday`,
      start_time: '05:00:00',
      end_time: '21:00:00',
      headway_secs: 30 * 60,
    });
    // Weekend frequency: every 60 minutes from 06:00 to 19:00
    frequencies.push({
      trip_id: `${route.route_id}_weekend`,
      start_time: '06:00:00',
      end_time: '19:00:00',
      headway_secs: 60 * 60,
    });
  }
  const freqWriter = createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, 'frequencies.txt'),
    header: ['trip_id','start_time','end_time','headway_secs'],
  });
  await freqWriter.writeRecords(frequencies);
  console.log('frequencies.txt written');

  console.log(`✅ Metrobus GTFS successfully generated in ${OUTPUT_DIR}`);
  console.log(`Total routes: ${routes.length}, total stops: ${stops.length}`);
}

generateGTFS().catch(console.error);