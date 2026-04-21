// services/transport/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Single shared type definition for the entire transport layer.
// Both the provider implementations and the UI screens import from here.
// ─────────────────────────────────────────────────────────────────────────────

export type TransportMode   = 'rail' | 'brt' | 'bus' | 'legacy_rail';
export type TapType         = 'IN' | 'OUT';
export type TapMode         = 'station' | 'bus';
export type TripStatus      = 'pending' | 'active' | 'completed' | 'cancelled' | 'missed_tapout';
export type TicketStatus    = 'active' | 'used' | 'expired' | 'cancelled';
export type LoanStatus      = 'active' | 'overdue' | 'repaid' | 'defaulted';
export type FareStrategy    = 'distance' | 'zone' | 'flat';
export type TransactionType = 'debit' | 'credit';

// ─── Stop / Station ───────────────────────────────────────────────────────────
export interface TransportStop {
  id:      string;
  name:    string;
  lat:     number;
  lon:     number;
  zoneId?: string;
}

// ─── Fare ─────────────────────────────────────────────────────────────────────
export interface FareResult {
  amount:    number;
  currency:  'ZAR';
  strategy:  FareStrategy;
  breakdown: string;   // human-readable e.g. "R11.00 (0–5 km, peak)"
}

// ─── Tap Event ────────────────────────────────────────────────────────────────
export interface TapEvent {
  userId:     string;
  locationId: string;
  type:       TapType;
  mode:       TapMode;
  routeId?:   string;
  vehicleId?: string;
  timestamp:  Date;
}

// ─── Trip ─────────────────────────────────────────────────────────────────────
export interface Trip {
  id:          string;
  userId:      string;
  provider:    string;
  origin:      TransportStop;
  destination: TransportStop;
  startTime:   Date;
  endTime?:    Date;
  fare?:       number;
  status:      TripStatus;
  metadata?:   Record<string, unknown>;
}

// ─── Ticket ───────────────────────────────────────────────────────────────────
export interface Ticket {
  id:          string;
  userId:      string;
  provider:    string;
  origin:      TransportStop;
  destination: TransportStop;
  validFrom:   Date;
  validUntil:  Date;
  fare:        number;
  qrCode:      string;
  status:      TicketStatus;
}

// ─── Loan ─────────────────────────────────────────────────────────────────────
export interface Loan {
  id:           string;
  userId:       string;
  amount:       number;
  repaidAmount: number;
  status:       LoanStatus;
  issuedAt:     Date;
  dueDate:      Date;
  repaidAt?:    Date;
  ticketId?:    string;
}

// ─── Wallet ───────────────────────────────────────────────────────────────────
export interface UserWallet {
  $id:       string;
  userId:    string;
  balance:   number;
  currency:  'ZAR';
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  $id:           string;
  userId:        string;
  type:          string;
  amount:        number;
  currency:      'ZAR';
  description:   string;
  status:        string;
  paymentMethod?: string;
  referenceId?:  string;
  metadata?:     string;
  createdAt:     string;
}

// ─── Provider Interface ───────────────────────────────────────────────────────
// Every transport provider must implement this contract.
// Methods are optional because not all providers support all flows.
export interface TransportProvider {
  readonly name:             string;
  readonly mode:             TransportMode;
  readonly providerId:       string;
  readonly supportsTap:      boolean;
  readonly supportsTickets:  boolean;
  readonly supportsManualTrip: boolean;

  /** Synchronous fare calculation — all data is local */
  calculateFare(
    origin:      TransportStop,
    destination: TransportStop,
    options?:    { isPeak?: boolean; categoryId?: string },
  ): FareResult;

  /** Minimum balance required before travel */
  minimumBalance(origin: TransportStop, destination: TransportStop): number;

  // Tap-based (Gautrain, Rea Vaya, Metrobus)
  tapIn?(
    userId:  string,
    stop:    TransportStop,
    options?: { routeId?: string; vehicleId?: string },
  ): Promise<Trip>;

  tapOut?(
    trip:        Trip,
    destination: TransportStop,
  ): Promise<{ trip: Trip; fare: FareResult }>;

  // Ticket-based (Metrorail)
  purchaseTicket?(
    userId:      string,
    origin:      TransportStop,
    destination: TransportStop,
    options?:    { isPeak?: boolean; categoryId?: string },
  ): Promise<Ticket>;

  // Manual / GPS (Metrobus)
  startTrip?(userId: string, origin: TransportStop): Promise<Trip>;
  endTrip?(trip: Trip, destination: TransportStop): Promise<{ trip: Trip; fare: FareResult }>;
}

// ─── Transaction payload (Appwrite) ──────────────────────────────────────────
export interface TransportTransactionPayload {
  type:        'transport';
  provider:    string;
  amount:      number;
  currency:    'ZAR';
  description: string;
  status:      'completed' | 'pending';
  metadata:    string;
}