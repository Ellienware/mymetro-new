import { Client, Account, Databases, Storage, Query, ID } from "appwrite"


const client = new Client()



client
  .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!)
  

export const account = new Account(client)
export const databases = new Databases(client)
export const storage = new Storage(client)

export const APPWRITE_API_KEY_CONFIG = process.env.EXPO_PUBLIC_APPWRITE_API_KEY;
export const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!
export const COLLECTIONS = {
  USERS: "users",
  TICKETS: "tickets",
  TRANSACTIONS: "transactions",
  WALLETS: "wallets",

  DRIVER_WALLETS: 'driver_wallets',
  DRIVER_TRANSACTIONS: 'driver_transactions',
  DRIVER_WITHDRAWALS: 'driver_withdrawals',
  DRIVER_PROFILES: 'DriverProfiles',

  FAVORITES: "favorites",
  PAYMENT_METHODS: "payment-methods",
  TAXI_ROUTES: "taxi_routes",
  METROBUS_TRIPS: "metrobus_trips",
  REA_VAYA_TRIPS: "rea_vaya_trips",
  MINIBUS_REQUESTS: "minibus_requests",
  MINIBUS_DRIVERS: "minibus_drivers",
  SHARED_TAXI_RIDES: "shared_taxi_rides",
  RIDE_REQUESTS: "ride_requests",
  LOANS: "loans",
  HOLDS: 'holds',
  
  SCHOOL_ROUTES: 'school_routes',
  SCHOOL_BOOKINGS: 'school_bookings',
  SCHOOL_TRIPS: 'school_trips',
  SCHOOLS: 'schools',
  SCHOOL_DRIVER_TRANSACTIONS: "school_driver_transactions",
  SCHOOL_DRIVER_WALLETS: 'school_driver_wallets',
  SCHOOL_DRIVER_WITHDRAWALS: 'school_driver_withdrawals',

  VIRTUAL_CARDS: 'virtual_cards',
  NOTIFICATIONS: 'notifications',
  SCHOOL_DRIVERS: 'SCHOOL_DRIVERS',
  DRIVER_VEHICLES: 'DRIVER_VEHICLES',
  DRIVER_SCHOOL_OFFERINGS: 'DRIVER_SCHOOL_OFFERINGS',
  CHILDREN: 'children',
  CHAT_ROOMS: 'CHAT_ROOMS',
  CHAT_MESSAGES: 'CHAT_MESSAGES',
  TAXI_DRIVERS: 'TAXI_DRIVERS',
  TAXI_TRIPS: 'TAXI_TRIPS',

  METER_DRIVERS: 'METER_DRIVERS',
  METER_RIDE_REQUESTS: 'METER_RIDE_REQUESTS',
  METER_RIDES: 'METER_RIDES',
  METER_DRIVER_LOCATIONS: 'METER_DRIVER_LOCATIONS',
  METER_DRIVER_WALLETS: 'meter_driver_wallets',
  METER_DRIVER_TRANSACTIONS: 'meter_driver_transactions',
  METER_DRIVER_WITHDRAWALS: 'meter_driver_withdrawals',
  FARE_RULES: 'FARE_RULES',
  
  ROUTE_ASSIGNMENTS: 'route_assignments',
  RANKS: 'ranks',
  RANK_ROUTES: 'rank_routes',
  RANK_QUEUES: 'rank_queues',

  ASSOCIATIONS: 'Associations',
  DRIVERS: 'Drivers',
  VEHICLES: 'Vehicles',

  FLAG_REQUESTS: "flag_requests",

  TRIPS: "trips",               // new
  TAP_EVENTS: "tap_events",     // new 
}
export const STORAGE_BUCKET_ID = process.env.EXPO_PUBLIC_DRIVER_DOCS_BUCKET!;
export const FILE_PREFIXES = {
  AVATAR: "avatar_",
  VIDEO: "video_",
  THUMBNAIL: "thumbnail_",
  REVIEW_PHOTO: "review_photo_",
  STATUS_IMAGE: "status_image_",
  DRIVER_DOCS: "driver_docs_",        // new
  SCHOOL_DOCS: "school_docs_",
  FLAG_REQUESTS: "flag_requests"       // new
} as const;
export { client, Query, ID }
