const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const GTFS_BASE = '/home/ellienware/Music/otp-server/otp_data';
const feeds = ['gautrain_gtfs', 'metrobus_gtfs', 'rea-vaya_gtfs'];

async function extractShapes() {
  const allShapes = {}; // key: "feedName_shapeId", value: array of {lat, lng}

  for (const feed of feeds) {
    const shapesPath = path.join(GTFS_BASE, feed, 'shapes.txt');
    if (!fs.existsSync(shapesPath)) {
      console.warn(`⚠️  No shapes.txt in ${feed}`);
      continue;
    }

    // Temporary map: shape_id -> array of points (unsorted)
    const shapeMap = new Map();

    await new Promise((resolve, reject) => {
      fs.createReadStream(shapesPath)
        .pipe(csv())
        .on('data', (row) => {
          const shapeId = row.shape_id;
          if (!shapeMap.has(shapeId)) shapeMap.set(shapeId, []);
          shapeMap.get(shapeId).push({
            lat: parseFloat(row.shape_pt_lat),
            lng: parseFloat(row.shape_pt_lon),
            sequence: parseInt(row.shape_pt_sequence, 10)
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Sort each shape by sequence and store with a unique key
    for (let [shapeId, points] of shapeMap.entries()) {
      points.sort((a, b) => a.sequence - b.sequence);
      const key = `${feed}_${shapeId}`;
      allShapes[key] = points.map(p => ({ latitude: p.lat, longitude: p.lng }));
    }
    console.log(`📐 ${feed}: ${shapeMap.size} shapes extracted`);
  }

  const outPath = path.join(__dirname, '../constants/gtfsShapes.json');
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(outPath, JSON.stringify(allShapes, null, 2));
  console.log(`✅ Saved ${Object.keys(allShapes).length} shapes to ${outPath}`);
}

extractShapes().catch(console.error);