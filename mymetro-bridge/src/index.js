import { createDB } from './utils/db.js';
import { createRideRequest, acceptRide } from './requests.js';
import { startRide, endRide } from './rides.js';
import { updateDriverLocation, setDriverOnline } from './drivers.js';
import { error } from './utils/response.js';

export default async (context) => {
  const req = context.req;
  const res = context.res;

  const headers = req.headers || {};
  const secret = headers['x-api-key'] || headers['X-Api-Key'];
  if (secret !== process.env.API_SECRET) {
    return error(res, 'Unauthorized', 401);
  }

  const db = createDB();
  const { path, method, body } = req;

  try {
    if (path === '/request-ride' && method === 'POST') {
      return createRideRequest(db, { body }, res);
    }
    if (path === '/accept-ride' && method === 'POST') {
      return acceptRide(db, { body }, res);
    }
    if (path === '/start-ride' && method === 'POST') {
      return startRide(db, { body }, res);
    }
    if (path === '/end-ride' && method === 'POST') {
      return endRide(db, { body }, res);
    }
    if (path === '/driver/location' && method === 'POST') {
      return updateDriverLocation(db, { body }, res);
    }
    if (path === '/driver/online' && method === 'POST') {
      return setDriverOnline(db, { body }, res);
    }
    return error(res, 'Not found', 404);
  } catch (err) {
    console.error(err);
    return error(res, err.message, 500);
  }
};