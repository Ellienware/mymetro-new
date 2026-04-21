const fs = require('fs');
const path = require('path');

// ===== CONFIGURATION =====
const stopsPath = path.join(__dirname, '../constants/allStops.ts');
const processedLogPath = path.join(__dirname, 'fetched_stops.log'); // IDs to fix
const municipalityLogPath = path.join(__dirname, 'municipality_fixed.log'); // resume log
const failedLogPath = path.join(__dirname, 'fix_failed.log');

const GAUTENG_BBOX = '-26.9,27.2,-25.6,28.9';
const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES = 5;
const FETCH_TIMEOUT = 15000;
const USER_AGENT = 'MyMetro/1.0 (https://mymetro.app; your-email@example.com)';

// ===== MODE DETECTION (copied from new script) =====
function detectModeFromTags(tags) {
  if (!tags) return null;

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
    return 'bus';
  }

  // Taxi ranks
  if (
    tags.amenity === 'taxi' ||
    (tags.public_transport === 'station' && tags.amenity === 'taxi')
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

  return null;
}

// ===== CITY BOUNDING BOXES (approximate) =====
const CITY_BOUNDARIES = [
  { name: 'Johannesburg', minLat: -26.3, maxLat: -26.0, minLon: 27.9, maxLon: 28.2 },
  { name: 'Pretoria', minLat: -25.8, maxLat: -25.6, minLon: 28.1, maxLon: 28.3 },
  { name: 'Ekurhuleni', minLat: -26.3, maxLat: -26.1, minLon: 28.1, maxLon: 28.4 },
  { name: 'Midrand', minLat: -26.0, maxLat: -25.9, minLon: 28.1, maxLon: 28.2 },
  { name: 'Centurion', minLat: -25.9, maxLat: -25.8, minLon: 28.1, maxLon: 28.2 },
  { name: 'Soweto', minLat: -26.3, maxLat: -26.1, minLon: 27.8, maxLon: 27.9 },
];

function getCityFromCoords(lat, lon) {
  for (const area of CITY_BOUNDARIES) {
    if (lat >= area.minLat && lat <= area.maxLat &&
        lon >= area.minLon && lon <= area.maxLon) {
      return area.name;
    }
  }
  return null;
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
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
  console.log(`✅ Loaded ${stops.length} stops.`);

  // Build map for quick lookup
  const stopMap = new Map(stops.map(s => [s.id, s]));

  // Read IDs from fetched_stops.log
  if (!fs.existsSync(processedLogPath)) {
    console.log('❌ fetched_stops.log not found. Nothing to fix.');
    return;
  }
  const idsToFix = fs.readFileSync(processedLogPath, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '');

  console.log(`🔍 Found ${idsToFix.length} stops to update.`);

  // Load already processed IDs from this correction run (optional resume)
  let processed = new Set();
  if (fs.existsSync(municipalityLogPath)) {
    const lines = fs.readFileSync(municipalityLogPath, 'utf8').split('\n').filter(Boolean);
    processed = new Set(lines);
    console.log(`🔄 Resuming – already updated ${processed.size} stops.`);
  }

  const toFix = idsToFix.filter(id => !processed.has(id));
  console.log(`⏳ Will update ${toFix.length} stops.`);

  let updatedCount = 0;
  let failed = [];

  for (const id of toFix) {
    const stop = stopMap.get(id);
    if (!stop) {
      console.log(`⚠️ Stop ${id} not found in current stops – skipping.`);
      processed.add(id);
      fs.appendFileSync(municipalityLogPath, id + '\n');
      continue;
    }

    const numericId = id.split('/')[1];
    console.log(`🌐 Fetching node ${numericId} (${id})...`);

    try {
      const element = await fetchNodeWithRetry(numericId);
      if (!element) {
        console.log(`⏩ Node ${id} not found – setting municipality to null, mode unchanged.`);
        stop.municipality = null;
        // mode unchanged – we don't know
      } else {
        // Try OSM city tags first
        let city = element.tags?.['addr:city'] || element.tags?.['is_in:city'];
        if (!city) {
          city = getCityFromCoords(element.lat, element.lon);
        }
        stop.municipality = city;

        // Detect mode from tags and update if different
        const correctMode = detectModeFromTags(element.tags);
        if (correctMode && correctMode !== stop.mode) {
          console.log(`   Mode changed: ${stop.mode} → ${correctMode}`);
          stop.mode = correctMode;
        }

        // Populate lines array with operator/network
        const lines = [];
        if (element.tags?.operator) lines.push(element.tags.operator);
        if (element.tags?.network && element.tags.network !== element.tags?.operator) {
          lines.push(element.tags.network);
        }
        // If still empty, fallback to a generic name based on mode
        if (lines.length === 0) {
          if (stop.mode === 'train') lines.push('Train');
          else if (stop.mode === 'brt') lines.push('BRT');
          else if (stop.mode === 'bus') lines.push('Bus');
          else if (stop.mode === 'taxi') lines.push('Taxi');
        }
        stop.lines = lines;
      }
      updatedCount++;
      processed.add(id);
      fs.appendFileSync(municipalityLogPath, id + '\n');
      console.log(`✅ Updated: ${stop.name} (mode: ${stop.mode}, city: ${stop.municipality || 'null'}, lines: ${stop.lines.join(', ')})`);
    } catch (error) {
      console.error(`❌ Failed to fetch ${id}:`, error.message);
      failed.push(id);
    }

    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  console.log(`✅ Updated ${updatedCount} stops.`);
  if (failed.length > 0) {
    fs.writeFileSync(failedLogPath, failed.join('\n'));
    console.log(`⚠️ ${failed.length} stops failed – see ${failedLogPath}`);
  }

  // Write back the updated stops array
  writeStopsFile(stops);
  console.log(`💾 Saved updated stops to ${stopsPath}`);
}

main().catch(console.error);