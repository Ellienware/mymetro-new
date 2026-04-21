// services/meterApi.ts
const API_URL = process.env.EXPO_PUBLIC_METER_API_URL || '';
const API_SECRET = process.env.EXPO_PUBLIC_METER_API_SECRET || '';

if (!API_URL || !API_SECRET) {
  console.warn('⚠️ Meter API configuration missing');
}

async function callApi<T>(endpoint: string, body: any): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_SECRET,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

// Passenger endpoints
export const requestRide = (passengerId: string, pickup: any, dropoff: any) =>
  callApi<{ requestId: string; estimatedFare: number }>('/request-ride', {
    passengerId,
    pickup,
    dropoff,
  });

export const cancelRide = (requestId: string) =>
  callApi<{ success: boolean }>('/cancel-ride', { requestId });

// Driver endpoints
export const acceptRide = (requestId: string, driverId: string) =>
  callApi<{ rideId: string }>('/accept-ride', { requestId, driverId });

export const startRide = (rideId: string, driverId: string) =>
  callApi<{ success: boolean }>('/start-ride', { rideId, driverId });

export const endRide = (rideId: string, driverId: string, endLocation: any, distance: number, duration: number) =>
  callApi<{ fare: number }>('/end-ride', { rideId, driverId, endLocation, distance, duration });

export const updateDriverLocation = (driverId: string, lat: number, lng: number) =>
  callApi<{ updated: boolean }>('/driver/location', { driverId, lat, lng });

export const setDriverOnline = (driverId: string, isOnline: boolean) =>
  callApi<{ isOnline: boolean }>('/driver/online', { driverId, isOnline });