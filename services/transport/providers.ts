// services/transport/providers.ts
// ─────────────────────────────────────────────────────────────────────────────
// Four concrete transport providers.
// All are stateless — they create Trip/Ticket objects but do NOT touch the
// wallet or database.  Persistence is the caller's responsibility
// (useTicketPurchase hook / payment service).
// ─────────────────────────────────────────────────────────────────────────────
import { ID } from '@/lib/appwrite';
import { getGautrainFare } from '@/constants/gautrainFares';
import { getMetrorailFare } from '@/constants/metrorailFares';
import {
  FareResult, Ticket, TransportProvider, TransportStop, Trip,
} from './types';
import {
  isPeakHour, DistanceBracket, distanceFare, haversineKm, flatFare,
} from './fareEngine';

// ─── QR payload (deterministic, offline-safe) ─────────────────────────────────
// FIX: removed hard-coded 'mymetro:ticket:…' string — use JSON so it can be
// parsed by the validator without fragile string-splitting.
function generateQR(userId: string, ticketId: string, validUntil: Date): string {
  const payload = JSON.stringify({ ticketId, userId, exp: validUntil.getTime() });
  return Buffer.from(payload).toString('base64');
}

// ─────────────────────────────────────────────────────────────────────────────
// A. GautrainProvider — Modern Rail (tap-in / tap-out, distance-based)
// ─────────────────────────────────────────────────────────────────────────────
export class GautrainProvider implements TransportProvider {
  readonly name              = 'Gautrain';
  readonly providerId        = 'gautrain';
  readonly mode              = 'rail' as const;
  readonly supportsTap       = true;
  readonly supportsTickets   = false;
  readonly supportsManualTrip = false;

  calculateFare(
    origin:  TransportStop,
    dest:    TransportStop,
    options: { isPeak?: boolean } = {},
  ): FareResult {
    const peak   = options.isPeak ?? isPeakHour();
    const amount = getGautrainFare(origin.name, dest.name, peak);
    return {
      amount,
      currency:  'ZAR',
      strategy:  'distance',
      breakdown: `R${amount} (${peak ? 'peak' : 'off-peak'})`,
    };
  }

  // FIX: original used calculateFare(origin, origin) which always returns the
  // minimum-station fare — now returns the actual fare + R5 buffer.
  minimumBalance(origin: TransportStop, destination: TransportStop): number {
    return this.calculateFare(origin, destination).amount + 5;
  }

  async tapIn(userId: string, stop: TransportStop, options: { routeId?: string } = {}): Promise<Trip> {
    return {
      id:          ID.unique(),
      userId,
      provider:    this.providerId,
      origin:      stop,
      destination: stop,          // updated on tap-out
      startTime:   new Date(),
      status:      'active',
      metadata:    { routeId: options.routeId ?? null },
    };
  }

  async tapOut(trip: Trip, destination: TransportStop): Promise<{ trip: Trip; fare: FareResult }> {
    const fare: FareResult = this.calculateFare(trip.origin, destination);
    const completed: Trip  = {
      ...trip,
      destination,
      endTime: new Date(),
      fare:    fare.amount,
      status:  'completed',
    };
    return { trip: completed, fare };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// B. ReaVayaProvider — BRT (tap + on-bus validation, distance brackets)
// ─────────────────────────────────────────────────────────────────────────────
const REA_VAYA_BRACKETS: DistanceBracket[] = [
  { maxKm: 5,        peak: 11.00, offPeak: 9.90  },
  { maxKm: 10,       peak: 14.00, offPeak: 12.60 },
  { maxKm: 15,       peak: 16.50, offPeak: 14.85 },
  { maxKm: 25,       peak: 19.00, offPeak: 17.10 },
  { maxKm: 35,       peak: 21.00, offPeak: 18.90 },
  { maxKm: 45,       peak: 22.00, offPeak: 19.80 },
  { maxKm: Infinity, peak: 28.00, offPeak: 25.20 },
];

export class ReaVayaProvider implements TransportProvider {
  readonly name              = 'Rea Vaya';
  readonly providerId        = 'reavaya';
  readonly mode              = 'brt' as const;
  readonly supportsTap       = true;
  readonly supportsTickets   = false;
  readonly supportsManualTrip = false;

  calculateFare(
    origin:  TransportStop,
    dest:    TransportStop,
    options: { isPeak?: boolean } = {},
  ): FareResult {
    return distanceFare(origin, dest, REA_VAYA_BRACKETS, options.isPeak ?? isPeakHour());
  }

  minimumBalance(origin: TransportStop, dest: TransportStop): number {
    return this.calculateFare(origin, dest).amount;
  }

  async tapIn(
    userId:  string,
    stop:    TransportStop,
    options: { routeId?: string; vehicleId?: string } = {},
  ): Promise<Trip> {
    return {
      id:          ID.unique(),
      userId,
      provider:    this.providerId,
      origin:      stop,
      destination: stop,
      startTime:   new Date(),
      status:      'active',
      metadata:    { routeId: options.routeId ?? null, vehicleId: options.vehicleId ?? null },
    };
  }

  async tapOut(trip: Trip, destination: TransportStop): Promise<{ trip: Trip; fare: FareResult }> {
    const fare = this.calculateFare(trip.origin, destination);
    return {
      trip: { ...trip, destination, endTime: new Date(), fare: fare.amount, status: 'completed' },
      fare,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// C. MetrorailProvider — Legacy Rail (ticket-based, prepaid)
// ─────────────────────────────────────────────────────────────────────────────
export class MetrorailProvider implements TransportProvider {
  readonly name              = 'Metrorail';
  readonly providerId        = 'metrorail';
  readonly mode              = 'legacy_rail' as const;
  readonly supportsTap       = false;
  readonly supportsTickets   = true;
  readonly supportsManualTrip = false;

  calculateFare(
    origin:  TransportStop,
    dest:    TransportStop,
    options: { categoryId?: string } = {},
  ): FareResult {
    // Guard: if coordinates are missing, fall back to minimum fare
    const distKm = (origin.lat && dest.lat)
      ? haversineKm(origin.lat, origin.lon, dest.lat, dest.lon)
      : 0;
    const amount = getMetrorailFare(distKm, options.categoryId ?? 'metro');
    return {
      amount,
      currency:  'ZAR',
      strategy:  'distance',
      breakdown: `R${amount.toFixed(2)} (${distKm.toFixed(1)} km, ${options.categoryId ?? 'metro'})`,
    };
  }

  minimumBalance(origin: TransportStop, dest: TransportStop): number {
    return this.calculateFare(origin, dest).amount;
  }

  async purchaseTicket(
    userId:      string,
    origin:      TransportStop,
    destination: TransportStop,
    options:     { isPeak?: boolean; categoryId?: string } = {},
  ): Promise<Ticket> {
    const fare       = this.calculateFare(origin, destination, options);
    const ticketId   = ID.unique();
    const now        = new Date();
    const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h
    return {
      id:          ticketId,
      userId,
      provider:    this.providerId,
      origin,
      destination,
      validFrom:   now,
      validUntil,
      fare:        fare.amount,
      qrCode:      generateQR(userId, ticketId, validUntil),
      status:      'active',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// D. MetrobusProvider — Traditional Bus (manual/GPS, flat or distance fare)
// ─────────────────────────────────────────────────────────────────────────────
const METROBUS_BASE_FARE   = 8.00;
const METROBUS_RATE_PER_KM = 2.00;
const METROBUS_FLAT_FARE   = 12.00;

export class MetrobusProvider implements TransportProvider {
  readonly name              = 'Metrobus';
  readonly providerId        = 'metrobus';
  readonly mode              = 'bus' as const;
  readonly supportsTap       = true;
  readonly supportsTickets   = false;
  readonly supportsManualTrip = true;

  calculateFare(origin: TransportStop, dest: TransportStop): FareResult {
    // Use distance calculation only when both stops have valid coordinates
    if (origin.lat && origin.lon && dest.lat && dest.lon) {
      const km     = haversineKm(origin.lat, origin.lon, dest.lat, dest.lon);
      const amount = Math.round((METROBUS_BASE_FARE + km * METROBUS_RATE_PER_KM) * 100) / 100;
      return { amount, currency: 'ZAR', strategy: 'distance', breakdown: `R${amount.toFixed(2)} (${km.toFixed(1)} km)` };
    }
    return flatFare(METROBUS_FLAT_FARE, 'Metrobus flat fare');
  }

  minimumBalance(origin: TransportStop, dest: TransportStop): number {
    return this.calculateFare(origin, dest).amount;
  }

  async tapIn(userId: string, stop: TransportStop): Promise<Trip> {
    return {
      id:          ID.unique(),
      userId,
      provider:    this.providerId,
      origin:      stop,
      destination: stop,
      startTime:   new Date(),
      status:      'active',
    };
  }

  async tapOut(trip: Trip, destination: TransportStop): Promise<{ trip: Trip; fare: FareResult }> {
    const fare = this.calculateFare(trip.origin, destination);
    return {
      trip: { ...trip, destination, endTime: new Date(), fare: fare.amount, status: 'completed' },
      fare,
    };
  }

  // Aliases for manual-trip UI (delegates to tap methods)
  async startTrip(userId: string, origin: TransportStop): Promise<Trip> {
    return this.tapIn(userId, origin);
  }

  async endTrip(trip: Trip, destination: TransportStop): Promise<{ trip: Trip; fare: FareResult }> {
    return this.tapOut(trip, destination);
  }
}

// ─── Provider Registry ────────────────────────────────────────────────────────
const PROVIDERS: Record<string, TransportProvider> = {
  gautrain:  new GautrainProvider(),
  reavaya:   new ReaVayaProvider(),
  metrorail: new MetrorailProvider(),
  metrobus:  new MetrobusProvider(),
};

export function getProvider(id: string): TransportProvider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown transport provider: "${id}"`);
  return p;
}

export function getAllProviders(): TransportProvider[] {
  return Object.values(PROVIDERS);
}