import { ID, Query } from 'node-appwrite';
import { DATABASE_ID } from './utils/db.js';
import { calculateFare } from './utils/fare.js';
import { success, error } from './utils/response.js';

// Helper: get wallet by user ID (assumes a document with userId field)
async function getUserWallet(db, userId) {
  const wallets = await db.listDocuments(DATABASE_ID, 'WALLETS', [
    Query.equal('userId', userId)
  ]);
  if (wallets.documents.length === 0) {
    // Create a wallet if not exists (should not happen)
    return await db.createDocument(DATABASE_ID, 'WALLETS', ID.unique(), {
      userId,
      balance: 0,
      currency: 'ZAR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return wallets.documents[0];
}

async function transferMoney(db, fromUserId, toUserId, amount, description) {
  const fromWallet = await getUserWallet(db, fromUserId);
  const toWallet = await getUserWallet(db, toUserId);
  if (fromWallet.balance < amount) throw new Error('Insufficient balance');
  // Update balances
  await db.updateDocument(DATABASE_ID, 'WALLETS', fromWallet.$id, {
    balance: fromWallet.balance - amount,
    updatedAt: new Date().toISOString(),
  });
  await db.updateDocument(DATABASE_ID, 'WALLETS', toWallet.$id, {
    balance: toWallet.balance + amount,
    updatedAt: new Date().toISOString(),
  });
  // Record transactions
  const now = new Date().toISOString();
  await db.createDocument(DATABASE_ID, 'TRANSACTIONS', ID.unique(), {
    userId: fromUserId,
    type: 'transfer_sent',
    amount: -amount,
    currency: 'ZAR',
    description,
    status: 'completed',
    referenceId: `meter_ride_${Date.now()}`,
    createdAt: now,
  });
  await db.createDocument(DATABASE_ID, 'TRANSACTIONS', ID.unique(), {
    userId: toUserId,
    type: 'transfer_received',
    amount: amount,
    currency: 'ZAR',
    description,
    status: 'completed',
    referenceId: `meter_ride_${Date.now()}`,
    createdAt: now,
  });
}

export async function startRide(db, req, res) {
  const { rideId, driverId } = req.body;
  const ride = await db.getDocument(DATABASE_ID, 'METER_RIDES', rideId);
  if (ride.driverId !== driverId) return error(res, 'Unauthorized');
  await db.updateDocument(DATABASE_ID, 'METER_RIDES', rideId, {
    status: 'active',
    updatedAt: new Date().toISOString(),
  });
  await db.updateDocument(DATABASE_ID, 'METER_RIDE_REQUESTS', ride.requestId, {
    status: 'started',
    startedAt: new Date().toISOString(),
  });
  return success(res, { rideId });
}

export async function endRide(db, req, res) {
  const { rideId, driverId, endLocation, distance, duration } = req.body;
  const ride = await db.getDocument(DATABASE_ID, 'METER_RIDES', rideId);
  if (ride.driverId !== driverId) return error(res, 'Unauthorized');
  // Get fare rules
  const rulesDoc = await db.getDocument(DATABASE_ID, 'FARE_RULES', 'global');
  const finalFare = calculateFare(distance, duration, rulesDoc);
  // Transfer money from passenger to driver
  try {
    await transferMoney(db, ride.passengerId, driverId, finalFare, `Meter taxi ride ${rideId}`);
  } catch (err) {
    return error(res, err.message);
  }
  // Update ride
  await db.updateDocument(DATABASE_ID, 'METER_RIDES', rideId, {
    status: 'completed',
    endLocation: JSON.stringify(endLocation),
    distance,
    duration,
    fare: finalFare,
    updatedAt: new Date().toISOString(),
  });
  await db.updateDocument(DATABASE_ID, 'METER_RIDE_REQUESTS', ride.requestId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
  });
  await db.updateDocument(DATABASE_ID, 'METER_DRIVERS', driverId, {
    currentRideId: null,
    isOnline: true,
  });
  return success(res, { fare: finalFare });
}