// constants/metrorailFares.ts
export interface FareCategory {
  id: string;
  name: string;
  description: string;
}

export interface DistanceRange {
  id: string;
  label: string;
  minKm: number;
  maxKm: number | null;
}

export interface FarePrice {
  categoryId: string;
  distanceRangeId: string;
  price: number;
}

export const FARE_CATEGORIES: FareCategory[] = [
  { id: "metro", name: "Metro", description: "Standard metro service" },
  { id: "metro_plus", name: "MetroPlus", description: "Enhanced metro service" },
  { id: "metro_plus_express", name: "MetroPlus Express", description: "Premium express service" },
];

export const DISTANCE_RANGES: DistanceRange[] = [
  { id: "range_1", label: "<1–10km", minKm: 0, maxKm: 10 },
  { id: "range_2", label: "11–19km", minKm: 11, maxKm: 19 },
  { id: "range_3", label: "20–30km", minKm: 20, maxKm: 30 },
  { id: "range_4", label: "31–50km", minKm: 31, maxKm: 50 },
  { id: "range_5", label: "51–100km", minKm: 51, maxKm: 100 },
  { id: "range_6", label: ">100km", minKm: 101, maxKm: null },
];

export const FARE_PRICES: FarePrice[] = [
  // Metro
  { categoryId: "metro", distanceRangeId: "range_1", price: 7.5 },
  { categoryId: "metro", distanceRangeId: "range_2", price: 7.5 },
  { categoryId: "metro", distanceRangeId: "range_3", price: 8.5 },
  { categoryId: "metro", distanceRangeId: "range_4", price: 9.5 },
  { categoryId: "metro", distanceRangeId: "range_5", price: 11.5 },
  { categoryId: "metro", distanceRangeId: "range_6", price: 12.5 },
  // MetroPlus
  { categoryId: "metro_plus", distanceRangeId: "range_1", price: 9.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_2", price: 10.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_3", price: 11.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_4", price: 13.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_5", price: 18.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_6", price: 21.0 },
  // MetroPlus Express
  { categoryId: "metro_plus_express", distanceRangeId: "range_1", price: 11.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_2", price: 12.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_3", price: 13.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_4", price: 16.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_5", price: 23.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_6", price: 25.0 },
];

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getDistanceRange(distanceKm: number): DistanceRange | null {
  return DISTANCE_RANGES.find(range => {
    if (range.maxKm === null) return distanceKm >= range.minKm;
    return distanceKm >= range.minKm && distanceKm <= range.maxKm;
  }) || null;
}

export function getMetrorailFare(distanceKm: number, categoryId: string): number {
  const range = getDistanceRange(distanceKm);
  if (!range) return 0;
  const fare = FARE_PRICES.find(fp => fp.categoryId === categoryId && fp.distanceRangeId === range.id);
  return fare ? fare.price : 0;
}