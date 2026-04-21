const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Adjust this path to point to your OTP data folder
const GTFS_BASE = '/home/ellienware/Music/otp-server/otp_data';

// Define the three feeds and their corresponding transport mode
const feeds = [
  { name: 'gautrain_gtfs', mode: 'train' },
  { name: 'metrobus_gtfs', mode: 'bus' },
  { name: 'rea-vaya_gtfs', mode: 'brt' }
];

// Helper to read stops.txt from one feed
async function readStopsFromFeed(feed) {
  const stopsPath = path.join(GTFS_BASE, feed.name, 'stops.txt');
  if (!fs.existsSync(stopsPath)) {
    console.warn(`⚠️  Missing stops.txt in ${feed.name}`);
    return [];
  }

  const stops = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(stopsPath)
      .pipe(csv())
      .on('data', (row) => {
        // Some GTFS feeds use stop_lat / stop_lon; others use stop_latitude / stop_longitude
        const lat = parseFloat(row.stop_lat || row.stop_latitude);
        const lng = parseFloat(row.stop_lon || row.stop_longitude);
        if (isNaN(lat) || isNaN(lng)) return; // skip invalid

        stops.push({
          id: row.stop_id,
          name: row.stop_name,
          lat: lat,
          lng: lng,
          mode: feed.mode,
          feed: feed.name,
        });
      })
      .on('end', () => resolve(stops))
      .on('error', reject);
  });
}

async function main() {
  let allStops = [];
  for (const feed of feeds) {
    const stops = await readStopsFromFeed(feed);
    console.log(`📦 ${feed.name}: ${stops.length} stops`);
    allStops = allStops.concat(stops);
  }

  // Output JSON file into constants/ folder
  const outPath = path.join(__dirname, '../constants/gtfsStops.json');
  // Ensure directory exists
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(outPath, JSON.stringify(allStops, null, 2));
  console.log(`✅ Saved ${allStops.length} stops to ${outPath}`);
}

main().catch(console.error);