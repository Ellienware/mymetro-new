import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ALL_ROUTES } from './constants/allRoutes.js';
import { ALL_STOPS } from './constants/allStops.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log(`✅ Loaded ${ALL_ROUTES.length} routes, ${ALL_STOPS.length} stops`);

function normalizeOperator(op?: string): string {
  if (!op) return 'unknown';
  const mapping: Record<string, string> = {
    'Bombela Consession': 'Gautrain',
    'Gautrain': 'Gautrain',
    'Metrorail': 'Metrorail',
    'Shosholoza Meyl': 'Shosholoza Meyl',
    'Gautrain Bus': 'Gautrain',
    'Rea Vaya': 'BRT',
    'A Re Yeng': 'A Re Yeng',
    'Tshwane Bus Services': 'Tshwane Bus',
    'Yarona Bus': 'Yarona Bus',
    'TransMagnific': 'TransMagnific'
  };
  return mapping[op] || op;
}

const outputDir = path.join(__dirname, 'services');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const services = new Map<string, { routes: typeof ALL_ROUTES; stops: Set<string> }>();

for (const route of ALL_ROUTES) {
  const serviceName = normalizeOperator(route.operator || route.mode);
  if (!services.has(serviceName)) {
    services.set(serviceName, { routes: [], stops: new Set() });
  }
  const service = services.get(serviceName)!;
  service.routes.push(route);
  for (const stopId of route.stops) {
    service.stops.add(stopId);
  }
}

console.log(`📦 Found ${services.size} unique services`);

const stopMap = new Map();
for (const stop of ALL_STOPS) {
  stopMap.set(stop.id, stop);
}

for (const [serviceName, { routes, stops }] of services.entries()) {
  const safeName = serviceName.replace(/\s+/g, '_');
  const serviceDir = path.join(outputDir, safeName);
  if (!fs.existsSync(serviceDir)) fs.mkdirSync(serviceDir, { recursive: true });

  let routesContent = '';
  for (const route of routes) {
    routesContent += `Route ID: ${route.id}\n`;
    routesContent += `Name: ${route.name}\n`;
    routesContent += `Mode: ${route.mode}\n`;
    routesContent += `Colour: ${route.colour || 'N/A'}\n`;
    routesContent += `Operator: ${route.operator || 'N/A'}\n`;
    routesContent += `Stop order (OSM node IDs): ${route.stops.join(', ')}\n`;
    routesContent += `\n---\n\n`;
  }
  fs.writeFileSync(path.join(serviceDir, 'routes.txt'), routesContent);

  let stopsContent = '';
  for (const stopId of stops) {
    const stop = stopMap.get(stopId);
    if (stop) {
      stopsContent += `Stop ID: ${stop.id}\n`;
      stopsContent += `Name: ${stop.name}\n`;
      stopsContent += `Mode: ${stop.mode}\n`;
      stopsContent += `Coordinates: ${stop.coordinates.latitude}, ${stop.coordinates.longitude}\n`;
      stopsContent += `Lines serving this stop: ${stop.lines.join(', ')}\n`;
      stopsContent += `\n---\n\n`;
    } else {
      stopsContent += `Stop ID: ${stopId} (not found in ALL_STOPS)\n\n---\n\n`;
    }
  }
  fs.writeFileSync(path.join(serviceDir, 'stops.txt'), stopsContent);

  console.log(`✅ Written: ${serviceName} (${routes.length} routes, ${stops.size} stops)`);
}

console.log(`🎉 All services extracted to ${outputDir}`);