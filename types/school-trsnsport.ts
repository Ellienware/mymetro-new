// types/school-transport.ts
import { Models } from 'appwrite';

export interface SchoolDriver extends Models.Document {
  userId: string;
  fullName: string;
  phone: string;
  email?: string;
  driverLicense: string;
  pdpNumber?: string;
  documents?: string; // JSON { profileId, licenseId, pdpId, policeId }
  verificationStatus: 'pending' | 'approved' | 'rejected';
  verificationNotes?: string;
  rating: number;
  totalRatings: number;
  createdAt: string;
}

export interface DriverVehicle extends Models.Document {
  ownerId: string;        // references SCHOOL_DRIVERS.$id
  assignedDriverId: string;
  assignmentStatus: 'pending' | 'active' | 'rejected';
  plateNumber: string;
  make?: string;
  model?: string;
  year?: number;
  capacity: number;
  vehicleDocuments?: string; // JSON array of file IDs
  verificationStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface DriverSchoolOffering extends Models.Document {
  vehicleId: string;
  driverId: string;       // references SCHOOL_DRIVERS.$id
  schoolName: string;
  schoolLat: number;
  schoolLng: number;
  schoolPlaceId?: string;
  baseAddress: string;
  baseLat: number;
  baseLng: number;
  serviceRadiusKm: number;
  price: number;
  pricePeriod: 'weekly' | 'monthly';
  operatingHoursMorning: string;
  operatingHoursAfternoon?: string;
  note?: string;
  capacity: number;
  availableSeats: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Child extends Models.Document {
  parentId: string;       // references USERS.$id (Clerk user)
  name: string;
  school?: string;
  grade?: string;
  birthDate?: string;
  notes?: string;
  createdAt: string;
}

export interface ChatRoom extends Models.Document {
  participants: string;   // JSON array [parentId, driverId]
  bookingId: string;      // references SCHOOL_BOOKINGS.$id
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
}

export interface ChatMessage extends Models.Document {
  roomId: string;
  senderId: string;
  text: string;
  read: boolean;
  createdAt: string;
}

// Re-export existing types if needed
export interface SchoolBooking extends Models.Document {
  parentId: string;
  offeringId: string;
  selectedSchool: string;
  price: number;
  childIds: string;       // JSON array of child names
  pickupAddress: string;
  homeLat: number;
  homeLng: number;
  startDate: string;
  endDate: string;
  totalAmount: number;
  paymentStatus: string;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface SchoolTrip extends Models.Document {
  offeringId: string;
  date: string;
  status: 'not_started' | 'started' | 'completed';
  currentLocation?: string; // JSON { lat, lng }
  childrenStatus?: string;   // JSON array of pickup/dropoff times
}