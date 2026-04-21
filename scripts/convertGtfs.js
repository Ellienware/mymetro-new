// scripts/convertGtfs.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Folder containing the original .txt files (Metrobus)
const TXT_DIR = path.join(__dirname, '../assets/gtfs/rea-vaya');
const JSON_DIR = path.join(__dirname, '../assets/gtfs/rea-vaya');

// Define expected headers for each file (since some files lack headers)
const HEADERS = {
  'routes.txt': ['route_id', 'route_short_name', 'route_long_name', 'route_type'],
  'stops.txt': ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'],
  'stop_times.txt': ['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'],
  'trips.txt': ['trip_id', 'route_id', 'service_id'],
  'calendar.txt': ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
  'frequencies.txt': ['trip_id', 'start_time', 'end_time', 'headway_secs'],
};

async function convertFile(filename) {
  const inputPath = path.join(TXT_DIR, filename);
  const outputPath = path.join(JSON_DIR, filename.replace('.txt', '.json'));
  
  if (!fs.existsSync(inputPath)) {
    console.warn(`File not found: ${inputPath}`);
    return;
  }

  const fileStream = fs.createReadStream(inputPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isFirstLine = true;
  let headers = null;
  const rows = [];

  for await (const line of rl) {
    if (line.trim() === '') continue;
    // Split by comma, but handle quotes properly (simple split for GTFS)
    const fields = line.split(',').map(f => f.trim());
    if (isFirstLine) {
      // Check if the first line looks like headers (contains typical header words)
      const looksLikeHeader = fields.some(f => f === 'route_id' || f === 'stop_id' || f === 'trip_id');
      if (looksLikeHeader) {
        headers = fields;
      } else {
        // First line is data – use predefined headers
        headers = HEADERS[filename];
        if (!headers) {
          console.error(`No headers defined for ${filename}`);
          return;
        }
        // Process this line as data
        const obj = {};
        headers.forEach((h, i) => { obj[h] = fields[i]; });
        rows.push(obj);
      }
      isFirstLine = false;
    } else {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = fields[i]; });
      rows.push(obj);
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2));
  console.log(`Converted ${filename} -> ${outputPath}`);
}

// Ensure directories exist
if (!fs.existsSync(TXT_DIR)) fs.mkdirSync(TXT_DIR, { recursive: true });
if (!fs.existsSync(JSON_DIR)) fs.mkdirSync(JSON_DIR, { recursive: true });

// List all .txt files in TXT_DIR
const files = fs.readdirSync(TXT_DIR).filter(f => f.endsWith('.txt'));

Promise.all(files.map(convertFile)).then(() => {
  console.log('All conversions complete.');
});