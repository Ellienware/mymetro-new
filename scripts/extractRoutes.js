const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const GTFS_BASE = '/home/ellienware/Music/otp-server/otp_data';
const feeds = [
  { name: 'gautrain_gtfs', mode: 'train' },
  { name: 'metrobus_gtfs', mode: 'bus' },
  { name: 'rea-vaya_gtfs', mode: 'brt' }
];

async function readRoutesFromFeed(feed) {
  const routesPath = path.join(GTFS_BASE, feed.name, 'routes.txt');
  if (!fs.existsSync(routesPath)) {
    console.warn(`⚠️  No routes.txt in ${feed.name}`);
    return [];
  }

  const routes = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(routesPath)
      .pipe(csv())
      .on('data', (row) => {
        routes.push({
          id: row.route_id,
          shortName: row.route_short_name,
          longName: row.route_long_name,
          type: parseInt(row.route_type, 10),
          color: row.route_color,
          textColor: row.route_text_color,
          mode: feed.mode,
          feed: feed.name,
        });
      })
      .on('end', () => resolve(routes))
      .on('error', reject);
  });
}

async function main() {
  let allRoutes = [];
  for (const feed of feeds) {
    const routes = await readRoutesFromFeed(feed);
    console.log(`🚏 ${feed.name}: ${routes.length} routes`);
    allRoutes = allRoutes.concat(routes);
  }

  const outPath = path.join(__dirname, '../constants/gtfsRoutes.json');
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(outPath, JSON.stringify(allRoutes, null, 2));
  console.log(`✅ Saved ${allRoutes.length} routes to ${outPath}`);
}

main().catch(console.error);