import { DATABASE_ID } from './utils/db.js';
import { success, error } from './utils/response.js';

export async function updateDriverLocation(db, req, res) {
  const { driverId, lat, lng } = req.body;
  if (!driverId || lat === undefined || lng === undefined) return error(res, 'Missing fields');
  const now = new Date().toISOString();
  // Upsert location
  const existing = await db.listDocuments(DATABASE_ID, 'METER_DRIVER_LOCATIONS', [
    Query.equal('driverId', driverId)
  ]);
  if (existing.documents.length) {
    await db.updateDocument(DATABASE_ID, 'METER_DRIVER_LOCATIONS', existing.documents[0].$id, { lat, lng, updatedAt: now });
  } else {
    await db.createDocument(DATABASE_ID, 'METER_DRIVER_LOCATIONS', ID.unique(), { driverId, lat, lng, updatedAt: now });
  }
  return success(res, { updated: true });
}

export async function setDriverOnline(db, req, res) {
  const { driverId, isOnline } = req.body;
  await db.updateDocument(DATABASE_ID, 'METER_DRIVERS', driverId, { isOnline });
  return success(res, { isOnline });
}