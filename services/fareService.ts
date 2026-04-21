// services/fareService.ts
import { getGautrainFare } from '../constants/gautrainFares';
import { getFarePrice, FARE_CATEGORIES } from '../constants/fareData';

// Helper to clean station names (e.g., "Park Station" → "Park")
const normalizeStation = (name: string): string => {
  const cleaned = name
    .replace(/Gautrain|Station|platform|Bus|Terminal/gi, '')
    .trim();
  const aliases: Record<string, string> = {
    'Park': 'Park',
    'Sandton': 'Sandton',
    'Pretoria': 'Pretoria',
    'Hatfield': 'Hatfield',
    'Centurion': 'Centurion',
    'Midrand': 'Midrand',
    'Marlboro': 'Marlboro',
    'Rosebank': 'Rosebank',
    'Rhodesfield': 'Rhodesfield',
    'OR Tambo': 'OR Tambo',
    'O.R. Tambo': 'OR Tambo',
  };
  return aliases[cleaned] || cleaned;
};

// Determine if a leg is Gautrain
const isGautrainLeg = (leg: any): boolean => {
  return leg.mode === 'RAIL' && leg.agencyName?.toLowerCase().includes('gautrain');
};

// Determine service category from leg details (for Metrorail etc.)
const getServiceCategory = (leg: any): string => {
  const agency = leg.agencyName?.toLowerCase() || '';
  const route = leg.route?.toLowerCase() || '';
  
  if (agency.includes('rea vaya')) return 'brt';
  if (agency.includes('metrobus')) return 'bus';
  if (agency.includes('gautrain')) return 'rail';
  
  // For Metrorail, we might need to infer from route name or default to "metro"
  // You could also map specific route numbers to metro_plus or metro_plus_express
  if (route.includes('metro plus express')) return 'metro_plus_express';
  if (route.includes('metro plus')) return 'metro_plus';
  if (agency.includes('metrorail') || route.includes('metrorail')) return 'metro';
  
  return 'metro'; // default
};

// Calculate fare for a single leg
export const calculateLegFare = (leg: any, isPeak: boolean): number => {
  // Only charge for non‑walking legs
  if (leg.mode === 'WALK') return 0;

  // 1. Gautrain – use official fare table
  if (isGautrainLeg(leg)) {
    const fromStation = normalizeStation(leg.from.name);
    const toStation = normalizeStation(leg.to.name);
    const fare = getGautrainFare(fromStation, toStation, isPeak);
    if (fare > 0) return fare;
    // fallback to distance if station not found
  }

  // 2. Other services (Metrorail, Metrobus, Rea Vaya) – use distance‑based fare
  const distanceKm = leg.distance / 1000; // OTP distance is in meters
  const category = getServiceCategory(leg);
  
  // For now, we use "single" as fare type. You could later determine if it's return/weekly/monthly
  const fareString = getFarePrice(distanceKm, category, 'single');
  const fare = parseFloat(fareString.replace('R', ''));
  return isNaN(fare) ? 0 : fare;
};

// Calculate total fare for an itinerary
export const calculateTotalFare = (itinerary: any, isPeak: boolean): number => {
  let total = 0;
  for (const leg of itinerary.legs) {
    total += calculateLegFare(leg, isPeak);
  }
  return total;
};

// Helper to determine peak time from time string (HH:MM:SS)
export const isPeakHour = (timeStr: string): boolean => {
  const hour = parseInt(timeStr.split(':')[0], 10);
  // Define peak hours (e.g., 06:00-08:30 and 16:00-18:30)
  return (hour >= 6 && hour <= 8) || (hour >= 16 && hour <= 18);
};