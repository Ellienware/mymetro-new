// types/taxi.ts
import { Models } from 'appwrite';

export interface TaxiDriver extends Models.Document {
  userId: string;           // Clerk user ID
  driverId: string;         // Reference to SaaS `Drivers` collection
  vehicleId: string;        // Reference to SaaS `Vehicles` collection
  associationId: string;    // Reference to SaaS `Associations` collection
  idNumber: string;         // Driver's ID number (for verification)
  fullName?: string;
  phone?: string;
  license?: string;         // Driver's license number
  documents?: string;       // JSON string of file IDs
  createdAt: string;
}

export interface TaxiTrip extends Models.Document {
  driverId: string;         // Reference to `TAXI_DRIVERS.$id` (myMetro)
  vehicleId: string;        // Reference to SaaS `Vehicles.$id`
  routeId: string;          // Reference to SaaS `Routes.$id`
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'completed' | 'cancelled';
  passengerCount: number;
  cashCollected: number;
  digitalCollected: number;
  dailyRental: number;
  driverEarnings: number;
  currentLocation?: string; // JSON { lat, lng }
}


export interface Hold {
  $id: string;
  passengerId: string;
  driverId: string;
  amount: number;           // cents
  status: 'pending' | 'captured' | 'released';
  expiresAt: string;
  createdAt: string;
  tripId?: string;
}