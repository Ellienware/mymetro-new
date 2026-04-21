// services/saasBridge.ts
const BRIDGE_URL = process.env.EXPO_PUBLIC_BRIDGE_URL || '';
const API_SECRET = process.env.EXPO_PUBLIC_BRIDGE_API_SECRET || '';

if (!BRIDGE_URL || !API_SECRET) {
  console.warn('⚠️ Bridge configuration missing: EXPO_PUBLIC_BRIDGE_URL and EXPO_PUBLIC_BRIDGE_API_SECRET must be set in .env');
}

async function callBridge<T>(
  endpoint: string,
  params?: Record<string, string | undefined>,
  method: 'GET' | 'POST' | 'PATCH' = 'GET'
): Promise<T> {
  if (!BRIDGE_URL) throw new Error('Bridge URL not configured');
  const url = new URL(endpoint, BRIDGE_URL);
  const options: RequestInit = {
    method,
    headers: { 'x-api-key': API_SECRET, 'Content-Type': 'application/json' },
  };
  if (method !== 'GET' && params) {
    options.body = JSON.stringify(params);
  } else if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.append(k, v);
    });
  }
  const response = await fetch(url.toString(), options);
  const text = await response.text();
  if (!text) throw new Error('Empty response from bridge');
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON: ${text.substring(0, 100)}`);
  }
  if (!response.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

// Existing exports (keep them)
export const searchRoutes = (pickup: string, destination: string) =>
  callBridge<any[]>('/search-routes', { pickup, destination });

export const updateTrip = (tripId: string, updates: Record<string, any>) =>
  callBridge<any>('/update-trip', { tripId, ...updates }, 'PATCH');

export const getVehicle = (vehicleId: string) => {
  if (!vehicleId) throw new Error('vehicleId is required');
  return callBridge<any>('/vehicle', { vehicleId });
};

export const getTenants = () => callBridge<any[]>('/tenants');

export const getDriverByIdNumber = (idNumber: string, tenantId: string) => {
  if (!idNumber || !tenantId) throw new Error('idNumber and tenantId are required');
  return callBridge<any>('/driver', { idNumber, tenantId });
};

export const getDriverPrimaryVehicle = (driverId: string) => {
  if (!driverId) throw new Error('driverId is required');
  return callBridge<any>('/driver/primary-vehicle', { driverId });
};

export const getVehicleRoutes = (vehicleId: string) => {
  if (!vehicleId) throw new Error('vehicleId is required');
  return callBridge<any[]>('/vehicle/routes', { vehicleId });
};

export const getDriverShifts = (driverId: string, fromDate?: string) => {
  if (!driverId) throw new Error('driverId is required');
  return callBridge<any[]>('/driver/shifts', { driverId, fromDate });
};

export const getAnnouncements = (tenantId: string, limit?: number) => {
  if (!tenantId) throw new Error('tenantId is required');
  return callBridge<any[]>('/announcements', { tenantId, limit: limit?.toString() });
};

export const getRoute = (routeId: string) => {
  if (!routeId) throw new Error('routeId is required');
  return callBridge<any>('/route', { routeId });
};

// New queue exports
export const getRanks = (tenantId: string) => {
  if (!tenantId) throw new Error('tenantId is required');
  return callBridge<any[]>('/ranks', { tenantId });
};

export const getRankRoutes = (rankId: string) => {
  if (!rankId) throw new Error('rankId is required');
  return callBridge<any[]>('/rank-routes', { rankId });
};

export const getQueueEntry = (rankId: string, routeId: string, driverId: string) => {
  if (!rankId || !routeId || !driverId) throw new Error('rankId, routeId, and driverId are required');
  return callBridge<any>('/queue', { rankId, routeId, driverId });
};

export const createQueueEntry = (
  tenantId: string,
  rankId: string,
  routeId: string,
  driverId: string,
  vehicleId: string,
  registrationNumber: string
) => {
  if (!tenantId || !rankId || !routeId || !driverId || !vehicleId) throw new Error('Missing required fields');
  return callBridge<any>('/queue', {
    tenantId,
    rankId,
    routeId,
    driverId,
    vehicleId,
    registrationNumber,
  }, 'POST');
};

export const updateQueueEntry = (entryId: string, updates: { status?: string; loadingDeadline?: string; loadedAt?: string }) => {
  if (!entryId) throw new Error('entryId is required');
  return callBridge<any>('/queue', { entryId, ...updates }, 'PATCH');
};