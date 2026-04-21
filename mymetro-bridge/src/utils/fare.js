// Haversine distance in km
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Get duration from Google Directions API (to be implemented)
export async function estimateTrip(pickup, dropoff) {
  // For MVP, we will use a simple distance-based estimate.
  const distance = getDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
  const duration = distance * 2; // rough estimate: 2 min per km
  return { distance, duration };
}

export function calculateFare(distanceKm, durationMin, rules) {
  const base = rules.baseFare;
  const distCost = distanceKm * rules.ratePerKm;
  const timeCost = durationMin * rules.ratePerMinute;
  let fare = base + distCost + timeCost;
  fare *= rules.surgeMultiplier;
  if (rules.nightSurcharge > 0) fare += rules.nightSurcharge;
  return Math.round(fare * 100) / 100;
}