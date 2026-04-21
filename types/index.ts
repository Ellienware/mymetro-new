import { Models } from "appwrite"
import { UserTicket } from "./appwrite"

export interface Station {
  id: string
  name: string
  line: string
  zone: string
  coordinates: {
    latitude: number
    longitude: number
  }
}

export interface Route {
  id: string
  name: string
  stations?: number
  duration?: string
  color: string
  coordinates: {
    latitude: number
    longitude: number
  }[]
}



export interface TicketType {
  id: string
  name: string
  price: string
  description: string
}


export interface LocationCoords {
  latitude: number
  longitude: number
}

export interface FareZone {
  id: string
  name: string
  description: string
}

export interface FareType {
  id: string
  name: string
  description: string
}

export interface FarePrice {
  zoneFrom: string
  zoneTo: string
  fareTypeId: string
  price: string
}
export type Train = {
  id?: string;
  time: string;
  status: "On Time" | "Delayed" | "Cancelled";
  platform: string;
  trainNumber: string;
  delay?: string;
  isoTime?: string;
}

export type ScheduleData = {
  id: string;
  route: string;
  start: string;
  end: string;
  trainsOutbound: Train[];
  trainsInbound: Train[];
  direction?: string; // Optional if you want to keep it
}

// ===== NEW Multimodal Types (Add below) =====

export type TransportMode = 'train' | 'brt' | 'bus' | 'taxi';

export interface MultimodalStop {
    id: string;                // OSM node ID, e.g., "node/123456"
    name: string;
    mode: TransportMode;
    coordinates: {
        latitude: number;
        longitude: number;
    };
    lines: string[];           // Route names/refs serving this stop
    municipality?: string;
    source?: 'osm' | 'afrigis' | 'manual';
    lastUpdated?: string;
}

export interface MultimodalRoute {
    id: string;                // OSM relation ID, e.g., "relation/123456"
    mode: TransportMode;
    name: string;
    ref?: string;              // Short route number/identifier
    colour?: string;           // Route colour for display
    operator?: string;
    stops: string[];           // Array of stop IDs (OSM node IDs) in order
    geometry?: any;            // GeoJSON LineString/MultiLineString for map display
    source?: 'osm' | 'afrigis' | 'manual';
}

// Extended UserTicket for multimodal journeys
export interface MultimodalTicket extends UserTicket {
    mode: TransportMode;
    journeyLegs?: Array<{
        mode: TransportMode;
        fromStop: string;
        toStop: string;
        duration: number;       // in minutes
        distance: number;       // in km
        fare?: number;
        routeId?: string;
        routeName?: string;
    }>;
}

// Journey leg for trip planning results
export interface JourneyLeg {
    mode: TransportMode;
    from: MultimodalStop;
    to: MultimodalStop;
    startTime: string;          // ISO datetime
    endTime: string;
    duration: number;           // minutes
    distance: number;           // km
    fare?: number;
    routeId?: string;
    routeName?: string;
    instructions?: string[];    // turn-by-turn
    geometry?: any;             // GeoJSON for this leg
}

export interface JourneyOption {
    id: string;
    legs: JourneyLeg[];
    totalDuration: number;
    totalFare: number;
    transfers: number;
    departureTime: string;
    arrivalTime: string;
}

// ===== Metrobus Trips =====
export interface MetrobusTrip extends Models.Document {
  userId: string;
  entryStopId: string;
  entryStopName: string;
  entryTimestamp: string;
  exitStopId?: string;
  exitStopName?: string;
  exitTimestamp?: string;
  fare?: number;
  status: 'active' | 'completed' | 'penalty';
  penaltyAmount?: number;
}

export interface TaxiRoute extends Models.Document {
  name: string;
  fromRank: string;
  toRank: string;
  fromCoords: { lat: number; lng: number };
  toCoords: { lat: number; lng: number };
  polyline: Array<{ latitude: number; longitude: number }>;
  distanceKm: number;
  stops: Array<{ name: string; distance: number; coordinates: { lat: number; lng: number } }>;
  fares: number[];               // cumulative fares from origin, length = stops.length
}

export interface TaxiTrip extends Models.Document {
  driverId: string;
  driverPhone?: string;
  routeId: string;
  status: 'active' | 'completed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  currentLocation: { latitude: number; longitude: number };
  geohash: string;
  heading?: number;
  speed?: number;
  eta?: number;
}

export interface ActiveTaxiTrip {
  id: string;
  driverId: string;
  driverPhone?: string;
  routeId: string;
  currentLocation: { latitude: number; longitude: number };
  polyline?: Array<{ latitude: number; longitude: number }>;
  isCatchable?: boolean;
  routeName?: string;
  eta?: number;
  vehicleType?: string;      // NEW
  driverRating?: number;     // NEW
}

export interface ReaVayaTrip extends Models.Document {
  userId: string;
  entryStopId: string;
  entryStopName: string;
  entryTimestamp: string;
  exitStopId?: string;
  exitStopName?: string;
  exitTimestamp?: string;
  fare?: number; // in points
  status: 'active' | 'completed';
}

// Add Coordinates interface
export interface Coordinates {
  latitude: number;
  longitude: number;
}


export interface TrafficAlert {
  id: string;
  headline: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedRoads?: string[];
  startTime: string;
  endTime?: string;
}

export interface TrafficEvent {
  id: string;
  type: 'accident' | 'roadwork' | 'closure' | 'event';
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  severity?: 'low' | 'medium' | 'high';
  startTime: string;
  endTime?: string;
}

export interface TrafficCamera {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  status?: 'active' | 'inactive';
}

export interface SharedTaxiRide extends Models.Document {
  driverId: string;
  vehicleReg: string;
  capacity: number;
  availableSeats: number;
  routeId: string;
  currentLocation: { latitude: number; longitude: number };
  heading?: number;
  status: 'active' | 'full' | 'completed';
  geohash: string;
  lastUpdate: string;
  etaToNextStop?: number; // minutes
}

export interface SnappedPoint {
  point: { lat: number; lng: number };
  distanceKm: number;
}
export interface RideRequest extends Models.Document {
  passengerId: string;
  rideId: string;
  pickupStopIndex: number;
  dropoffStopIndex: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
  estimatedFare: number;
  pickupLocation?: { latitude: number; longitude: number }; // optional override
  createdAt: string;
  acceptedAt?: string;
  completedAt?: string;
}

export interface GTFSStop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  location_type: 0 | 1;
  parent_station?: string;
  wheelchair_boarding?: number;
  stop_code?: string;
}

export interface GTFSTrip {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign: string;
  direction_id: string;
  shape_id: string;
}

export interface GTFSStopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: number;
}

export interface GTFSRoute {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: 2 | 3; // 2 = train, 3 = bus
  route_color: string;
  route_text_color: string;
}

export interface GTFSFrequency {
  trip_id: string;
  start_time: string;
  end_time: string;
  headway_secs: number;
}

export interface GTFSCalendar {
  service_id: string;
  monday: 0 | 1;
  tuesday: 0 | 1;
  wednesday: 0 | 1;
  thursday: 0 | 1;
  friday: 0 | 1;
  saturday: 0 | 1;
  sunday: 0 | 1;
  start_date: string;
  end_date: string;
}

// At the end, after all interfaces
export type Stop = MultimodalStop;
