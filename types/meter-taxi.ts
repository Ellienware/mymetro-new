// types/meter-taxi.ts
import { Models } from 'appwrite';

export interface MeterDriver extends Models.Document {
  userId: string;               // Clerk user ID
  fullName: string;
  phone: string;
  vehicleReg: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor?: string;
  rating: number;
  totalRatings: number;
  isOnline: boolean;
  currentRideId?: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  verificationNotes?: string;
  documents?: string;           // JSON string of file IDs
  createdAt: string;
}

export interface MeterRideRequest extends Models.Document {
  passengerId: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  estimatedFare: number;
  status: 'pending' | 'accepted' | 'started' | 'completed' | 'cancelled';
  driverId?: string;
  createdAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface MeterRide extends Models.Document {
  requestId: string;
  driverId: string;
  passengerId: string;
  status: 'active' | 'completed' | 'cancelled';
  startLocation: string;        // JSON { lat, lng, address }
  endLocation?: string;         // JSON { lat, lng, address }
  distance?: number;            // km
  duration?: number;            // minutes
  fare: number;
  paymentMethod: 'wallet' | 'card' | 'cash';
  createdAt: string;
  updatedAt: string;
}

export interface MeterDriverLocation extends Models.Document {
  driverId: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

export interface FareRules extends Models.Document {
  baseFare: number;
  ratePerKm: number;
  ratePerMinute: number;
  surgeMultiplier: number;
  nightSurcharge: number;
}