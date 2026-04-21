import { ID, Query } from 'node-appwrite';
import { DATABASE_ID } from './utils/db.js';
import { estimateTrip, calculateFare } from './utils/fare.js';
import { success, error } from './utils/response.js';

export async function createRideRequest(db, req, res) {
  const { passengerId, pickup, dropoff } = req.body;
  if (!passengerId || !pickup || !dropoff) {
    return error(res, 'Missing required fields');
  }
  // Estimate distance and duration
  const { distance, duration } = await estimateTrip(pickup, dropoff);
  // Fetch fare rules
  const rulesDoc = await db.getDocument(DATABASE_ID, 'FARE_RULES', 'global');
  const estimatedFare = calculateFare(distance, duration, rulesDoc);
  // Create request
  const request = await db.createDocument(DATABASE_ID, 'METER_RIDE_REQUESTS', ID.unique(), {
    passengerId,
    pickupLat: pickup.lat, pickupLng: pickup.lng, pickupAddress: pickup.address,
    dropoffLat: dropoff.lat, dropoffLng: dropoff.lng, dropoffAddress: dropoff.address,
    estimatedFare,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  // Trigger driver matching (find nearby online drivers)
  // For MVP, we'll simply return the request ID; drivers will poll or we'll use real-time subscriptions.
  return success(res, { requestId: request.$id, estimatedFare });
}

export async function acceptRide(db, req, res) {
  const { requestId, driverId } = req.body;
  if (!requestId || !driverId) return error(res, 'Missing requestId or driverId');
  const request = await db.getDocument(DATABASE_ID, 'METER_RIDE_REQUESTS', requestId);
  if (request.status !== 'pending') return error(res, 'Request already taken or expired');
  // Update request
  await db.updateDocument(DATABASE_ID, 'METER_RIDE_REQUESTS', requestId, {
    status: 'accepted',
    driverId,
    acceptedAt: new Date().toISOString(),
  });
  // Create ride record
  const ride = await db.createDocument(DATABASE_ID, 'METER_RIDES', ID.unique(), {
    requestId,
    driverId,
    passengerId: request.passengerId,
    status: 'active',
    startLocation: JSON.stringify({ lat: request.pickupLat, lng: request.pickupLng, address: request.pickupAddress }),
    fare: request.estimatedFare,
    paymentMethod: 'wallet',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  // Update driver's current ride
  await db.updateDocument(DATABASE_ID, 'METER_DRIVERS', driverId, { currentRideId: ride.$id, isOnline: false });
  return success(res, { rideId: ride.$id });
}