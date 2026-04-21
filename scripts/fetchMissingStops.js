const fs = require('fs');
const path = require('path');

// ===== CONFIGURATION =====
const routesPath = path.join(__dirname, '../constants/allRoutes.ts');
const stopsPath = path.join(__dirname, '../constants/allStops.ts');
const processedLogPath = path.join(__dirname, 'fetched_stops.log');
const failedLogPath = path.join(__dirname, 'failed_stops.log');

// Gauteng bounding box
const GAUTENG_BBOX = '-26.9,27.2,-25.6,28.9';

// Delay between requests (ms)
const REQUEST_DELAY_MS = 3000;

// Number of retries
const MAX_RETRIES = 5;

// Timeout per request (ms)
const FETCH_TIMEOUT = 15000;

// User‑Agent – required by Overpass
const USER_AGENT = 'MyMetro/1.0 (https://mymetro.app; your-email@example.com)';

// ===== MODE DETECTION =====

/**
 * Detect transport mode from OSM tags.
 * Returns: 'train' | 'brt' | 'bus' | 'taxi' | 'train' (default)
 */
function detectModeFromTags(tags) {
  if (!tags) return 'train';

  // Rea Vaya BRT
  if (
    tags.operator === 'Rea Vaya' ||
    tags.network === 'Rea Vaya' ||
    (tags.bus === 'yes' && tags.operator === 'Rea Vaya')
  ) {
    return 'brt';
  }

  // Metrobus
  if (
    tags.operator?.includes('Metrobus') ||
    tags.operator?.includes('Metro Bus') ||
    tags.network?.includes('Metrobus')
  ) {
    return 'bus';
  }

  // Gautrain bus – treat as bus
  if (tags.operator === 'Gautrain Bus' || tags.network === 'Gautrain') {
    return 'bus'; // or you could keep as 'train' if you prefer
  }

  // Taxi ranks
  if (
    tags.amenity === 'taxi' ||
    tags.public_transport === 'station' && tags.amenity === 'taxi'
  ) {
    return 'taxi';
  }

  // Train stations (including Gautrain and Metrorail)
  if (
    tags.railway === 'station' ||
    tags.station === 'subway' ||
    tags.operator === 'Bombela Consession' ||
    tags.operator === 'Metrorail' ||
    tags.network === 'Gautrain'
  ) {
    return 'train';
  }

  // Bus stops (fallback)
  if (tags.highway === 'bus_stop' || tags.bus === 'yes') {
    return 'bus';
  }

  // Default
  return 'train';
}

// ===== HELPER FUNCTIONS =====

function extractArrayFromTS(filePath, arrayName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const regex = new RegExp(`export const ${arrayName}\\s*(?::[^=]*)?=\\s*(\\[[\\s\\S]*?\\]);`);
  const match = content.match(regex);
  if (!match) throw new Error(`Could not find ${arrayName} in ${filePath}`);
  return eval(match[1]);
}

function writeStopsFile(stopsArray) {
  const output = `// Auto-generated from OSM on ${new Date().toISOString()}
import { Stop } from '../types';

export const ALL_STOPS: Stop[] = ${JSON.stringify(stopsArray, null, 2)};
`;
  fs.writeFileSync(stopsPath, output);
}

async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        ...(options.headers || {}),
      },
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function fetchNodeWithRetry(nodeId, retries = MAX_RETRIES) {
  const url = `https://overpass-api.de/api/interpreter?data=[out:json];node(${nodeId})(${GAUTENG_BBOX});out;`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url);

      if (response.status === 429) {
        const wait = Math.pow(2, attempt) * 2000;
        console.log(`⏳ Rate limited, waiting ${wait / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, wait));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.elements[0];
    } catch (error) {
      const isTimeout = error.name === 'AbortError';
      const errorMsg = isTimeout ? 'Timeout' : error.message;
      console.log(`⏳ Attempt ${attempt + 1} failed: ${errorMsg}`);
      if (attempt === retries - 1) throw new Error(`Failed after ${retries} attempts: ${errorMsg}`);
      const wait = Math.pow(2, attempt) * 2000;
      console.log(`⏳ Retrying in ${wait / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
}

// ===== MAIN SCRIPT =====

async function main() {
  console.log('📖 Reading current stops...');
  let stops;
  try {
    stops = extractArrayFromTS(stopsPath, 'ALL_STOPS');
  } catch (err) {
    console.error('❌ Failed to read stops:', err.message);
    return;
  }
  const existingStopIds = new Set(stops.map(s => s.id));
  console.log(`✅ Loaded ${existingStopIds.size} stops.`);

  console.log('📖 Reading routes...');
  let routes;
  try {
    routes = extractArrayFromTS(routesPath, 'ALL_ROUTES');
  } catch (err) {
    console.error('❌ Failed to read routes:', err.message);
    return;
  }

  // Collect ALL node stop IDs from ALL routes (all modes)
  const allNodeIds = new Set();
  routes.forEach(route => {
    if (route.stops && Array.isArray(route.stops)) {
      route.stops.forEach(stopId => {
        if (typeof stopId === 'string' && stopId.startsWith('node/')) {
          allNodeIds.add(stopId);
        }
      });
    }
  });
  console.log(`✅ Found ${allNodeIds.size} node stop references in routes.`);

  const missingIds = Array.from(allNodeIds).filter(id => !existingStopIds.has(id));
  console.log(`🔍 Missing ${missingIds.length} node stops.`);

  if (missingIds.length === 0) {
    console.log('✨ No missing stops. Exiting.');
    return;
  }

  // Load already processed IDs (successful)
  let processed = new Set();
  if (fs.existsSync(processedLogPath)) {
    const lines = fs.readFileSync(processedLogPath, 'utf8').split('\n').filter(Boolean);
    processed = new Set(lines);
    console.log(`🔄 Resuming – already processed ${processed.size} stops.`);
  }

  // Load failed IDs (to skip them this run)
  let failed = new Set();
  if (fs.existsSync(failedLogPath)) {
    const lines = fs.readFileSync(failedLogPath, 'utf8').split('\n').filter(Boolean);
    failed = new Set(lines);
    console.log(`⚠️ Previously failed ${failed.size} stops – will skip this run.`);
  }

  const toFetch = missingIds.filter(id => !processed.has(id) && !failed.has(id));
  console.log(`⏳ Will fetch ${toFetch.length} new stops.`);

  const newStops = [];

  for (const id of toFetch) {
    const numericId = id.split('/')[1];
    console.log(`🌐 Fetching node ${numericId} (${id})...`);

    try {
      const element = await fetchNodeWithRetry(numericId);

      if (!element) {
        console.log(`⏩ Node ${id} not in Gauteng – skipping.`);
        processed.add(id);
        fs.appendFileSync(processedLogPath, id + '\n');
        continue;
      }

      const mode = detectModeFromTags(element.tags);
      const stop = {
        id: `node/${element.id}`,
        name: element.tags?.name || element.tags?.ref || `Stop ${element.id}`,
        mode: mode,
        coordinates: {
          latitude: element.lat,
          longitude: element.lon,
        },
        lines: element.tags?.route ? [element.tags.route] : [],
        municipality: element.tags?.addr_city || 'Johannesburg',
        source: 'osm',
        lastUpdated: new Date().toISOString(),
      };

      newStops.push(stop);
      processed.add(id);
      fs.appendFileSync(processedLogPath, id + '\n');
      console.log(`✅ Fetched: ${stop.name} (${mode})`);
    } catch (error) {
      console.error(`❌ Failed to fetch ${id}:`, error.message);
      fs.appendFileSync(failedLogPath, id + '\n');
    }

    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  console.log(`✅ Fetched ${newStops.length} new stops.`);

  if (newStops.length > 0) {
    const updatedStops = [...stops, ...newStops];
    writeStopsFile(updatedStops);
    console.log(`💾 Updated ${stopsPath} with ${updatedStops.length} total stops.`);
  } else {
    console.log('No new stops to add.');
  }
}

main().catch(console.error);