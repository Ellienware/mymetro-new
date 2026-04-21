import { Client, Databases, ID, Query, Permission, Role } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

// ===== CONFIGURE THESE =====
const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
const PROJECT_ID = "68505b630015642e04c9";
const API_KEY = 'standard_ca5b461f88bc2f9d5f5a7e3eb22f11d4b3104b83829353cbb8f55817f32dfd06d43b149202fe332fd323dea13ae6284dcfc1fc3ab6ad5da8f9c89e77ea655536c97bed5044e3a721d013992e3107ccd4aa0116656c4d5777a43d097032ecd22a271a1c3776f272a66c959e5f41c3232103844e7d7799b735a95cd50268651521';
const DATABASE_ID = "68505be8001a90ec85ed";
// ===========================

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

// ===== COLLECTION & ATTRIBUTE HELPERS =====
async function ensureCollection(collectionId, name, attributes) {
  let collectionExists = false;
  try {
    await databases.getCollection(DATABASE_ID, collectionId);
    collectionExists = true;
    console.log(`📁 ${collectionId} already exists.`);
  } catch (err) {
    if (err.code !== 404) throw err;
    console.log(`📁 Creating ${collectionId}...`);
    await databases.createCollection(DATABASE_ID, collectionId, name, [
      Permission.read(Role.any()),
      Permission.write(Role.any()),
      Permission.update(Role.any()),
      Permission.delete(Role.any()),
    ]);
  }

  for (const attr of attributes) {
    try {
      switch (attr.type) {
        case 'string':
          await databases.createStringAttribute(DATABASE_ID, collectionId, attr.key, attr.size, attr.required, attr.default);
          break;
        case 'integer':
          await databases.createIntegerAttribute(DATABASE_ID, collectionId, attr.key, attr.required, attr.default);
          break;
        case 'float':
          await databases.createFloatAttribute(DATABASE_ID, collectionId, attr.key, attr.required, attr.default);
          break;
        case 'datetime':
          await databases.createDatetimeAttribute(DATABASE_ID, collectionId, attr.key, attr.required);
          break;
        case 'boolean':
          await databases.createBooleanAttribute(DATABASE_ID, collectionId, attr.key, attr.required, attr.default);
          break;
      }
      console.log(`   ✅ ${attr.key} added.`);
    } catch (err) {
      if (err.code === 409) {
        console.log(`   ⏩ ${attr.key} already exists.`);
      } else {
        console.error(`   ❌ ${attr.key} error:`, err.message);
      }
    }
  }
  return collectionExists;
}

// Helper to create a document if it doesn't already exist by a unique field
async function createIfNotExists(collectionId, uniqueField, uniqueValue, data) {
  try {
    const existing = await databases.listDocuments(
      DATABASE_ID,
      collectionId,
      [Query.equal(uniqueField, uniqueValue)]
    );
    if (existing.total > 0) {
      console.log(`  ⏩ ${collectionId}: ${uniqueValue} already exists`);
      return existing.documents[0];
    }
    const doc = await databases.createDocument(
      DATABASE_ID,
      collectionId,
      ID.unique(),
      data
    );
    console.log(`  ✅ Created ${collectionId}: ${uniqueValue}`);
    return doc;
  } catch (err) {
    console.error(`  ❌ Error creating ${collectionId} ${uniqueValue}:`, err.message);
    return null;
  }
}

// ===== 1. ENSURE TAXI ROUTES COLLECTION =====
async function ensureTaxiRoutesCollection() {
  const attributes = [
    { key: 'name', type: 'string', size: 255, required: true },
    { key: 'fromRank', type: 'string', size: 255, required: true },
    { key: 'toRank', type: 'string', size: 255, required: true },
    { key: 'fromCoords', type: 'string', size: 255, required: true }, // store JSON
    { key: 'toCoords', type: 'string', size: 255, required: true },
    { key: 'distanceKm', type: 'float', required: true },
    { key: 'stops', type: 'string', size: 2000, required: true }, // store JSON array
    { key: 'fares', type: 'string', size: 1000, required: true }, // store JSON array
    { key: 'polyline', type: 'string', size: 5000, required: true }, // store JSON array
  ];
  await ensureCollection('taxi_routes', 'Taxi Routes', attributes);
}

// ===== 2. ENSURE SHARED TAXI RIDES COLLECTION (if needed) =====
async function ensureSharedRidesCollection() {
  const attributes = [
    { key: 'driverId', type: 'string', size: 255, required: true },
    { key: 'vehicleType', type: 'string', size: 20, required: true },
    { key: 'vehicleReg', type: 'string', size: 50, required: true },
    { key: 'capacity', type: 'integer', required: true },
    { key: 'availableSeats', type: 'integer', required: true },
    { key: 'routeId', type: 'string', size: 255, required: true },
    { key: 'currentLocation', type: 'string', size: 255, required: true }, // JSON
    { key: 'geohash', type: 'string', size: 12, required: true },
    { key: 'heading', type: 'float', required: false },
    { key: 'lastUpdate', type: 'datetime', required: true },
    { key: 'etaToNextStop', type: 'integer', required: false },
    { key: 'status', type: 'string', size: 20, required: true },
  ];
  await ensureCollection('shared_taxi_rides', 'Shared Taxi Rides', attributes);
}

// ===== 3. SAMPLE ROUTES =====
async function createSampleRoutes() {
  const routes = [
    {
      name: "Soweto - Joburg CBD",
      fromRank: "Soweto Taxi Rank",
      toRank: "Joburg CBD",
      fromCoords: JSON.stringify({ lat: -26.267, lng: 27.858 }),
      toCoords: JSON.stringify({ lat: -26.204, lng: 28.047 }),
      distanceKm: 15.2,
      stops: JSON.stringify([
        { name: "Soweto Taxi Rank", distance: 0, coordinates: { lat: -26.267, lng: 27.858 } },
        { name: "Orlando Stadium", distance: 3.5, coordinates: { lat: -26.234, lng: 27.923 } },
        { name: "Bara Taxi Rank", distance: 7.8, coordinates: { lat: -26.267, lng: 27.958 } },
        { name: "Joburg CBD", distance: 15.2, coordinates: { lat: -26.204, lng: 28.047 } }
      ]),
      fares: JSON.stringify([0, 8, 12, 18]),
      polyline: JSON.stringify([
        { latitude: -26.267, longitude: 27.858 },
        { latitude: -26.250, longitude: 27.900 },
        { latitude: -26.234, longitude: 27.923 },
        { latitude: -26.267, longitude: 27.958 },
        { latitude: -26.240, longitude: 28.000 },
        { latitude: -26.204, longitude: 28.047 }
      ])
    },
    {
      name: "Alexandra - Sandton",
      fromRank: "Alexandra Taxi Rank",
      toRank: "Sandton City",
      fromCoords: JSON.stringify({ lat: -26.105, lng: 28.104 }),
      toCoords: JSON.stringify({ lat: -26.107, lng: 28.054 }),
      distanceKm: 6.5,
      stops: JSON.stringify([
        { name: "Alexandra Taxi Rank", distance: 0, coordinates: { lat: -26.105, lng: 28.104 } },
        { name: "Marlboro", distance: 2.1, coordinates: { lat: -26.089, lng: 28.096 } },
        { name: "Sandton City", distance: 6.5, coordinates: { lat: -26.107, lng: 28.054 } }
      ]),
      fares: JSON.stringify([0, 5, 12]),
      polyline: JSON.stringify([
        { latitude: -26.105, longitude: 28.104 },
        { latitude: -26.089, longitude: 28.096 },
        { latitude: -26.107, longitude: 28.054 }
      ])
    }
  ];

  console.log('\n📁 Creating sample taxi routes...');
  for (const route of routes) {
    await createIfNotExists('taxi_routes', 'name', route.name, route);
  }
}

// ===== 4. SAMPLE DRIVERS =====
const sampleDrivers = [
  {
    fullName: "Thabo Mbeki",
    phone: "0821234567",
    idNumber: "8001015009089",
    driverLicenseNumber: "TMB123456",
    vehicleType: "minibus",
    vehicleReg: "ABC123GP",
    vehicleMake: "Toyota",
    vehicleModel: "Quantum",
    vehicleYear: 2020,
    vehicleColor: "White",
    capacity: 15,
    prdpNumber: "PRDP123",
    prdpExpiryDate: new Date("2027-12-31").toISOString(),
    operatingLicenceNumber: "OL12345",
    operatingLicenceExpiry: new Date("2028-06-30").toISOString(),
    insuranceProvider: "MiWay",
    insuranceExpiry: new Date("2026-12-31").toISOString(),
    verificationStatus: "approved",
    status: "active",
    isAvailable: true,
    rating: 4.5,
    totalRatings: 12,
    farePerKm: 2.5
  },
  {
    fullName: "Lerato Dlamini",
    phone: "0837654321",
    idNumber: "9001016001089",
    driverLicenseNumber: "LD987654",
    vehicleType: "sedan",
    vehicleReg: "XYZ456GP",
    vehicleMake: "Hyundai",
    vehicleModel: "i20",
    vehicleYear: 2022,
    vehicleColor: "Silver",
    capacity: 4,
    prdpNumber: null,
    prdpExpiryDate: null,
    operatingLicenceNumber: null,
    operatingLicenceExpiry: null,
    insuranceProvider: "Discovery",
    insuranceExpiry: new Date("2027-03-15").toISOString(),
    verificationStatus: "approved",
    status: "active",
    isAvailable: true,
    rating: 4.8,
    totalRatings: 28,
    farePerKm: 12.0
  },
  {
    fullName: "Sipho Ndlovu",
    phone: "0841122334",
    idNumber: "9501015001089",
    driverLicenseNumber: "SN112233",
    vehicleType: "motorcycle",
    vehicleReg: "MOT123GP",
    vehicleMake: "Honda",
    vehicleModel: "CBR250",
    vehicleYear: 2023,
    vehicleColor: "Red",
    capacity: 1,
    prdpNumber: null,
    prdpExpiryDate: null,
    operatingLicenceNumber: null,
    operatingLicenceExpiry: null,
    insuranceProvider: "Outsurance",
    insuranceExpiry: new Date("2026-10-20").toISOString(),
    verificationStatus: "approved",
    status: "active",
    isAvailable: true,
    rating: 4.2,
    totalRatings: 45,
    farePerKm: 8.0
  }
];

async function createDrivers() {
  console.log('\n👥 Creating driver profiles...');
  const existingDrivers = await databases.listDocuments(DATABASE_ID, 'DriverProfiles');
  if (existingDrivers.total > 0) {
    console.log('  ⏩ Drivers already exist, skipping creation.');
    return;
  }

  // Placeholder Clerk user IDs (for sample data)
  const clerkUserIds = [
    'user_2oQ6jL7cZ8fA1bXpY3wE9rT2',
    'user_3pR7kM8dY9gB2cZqU4xF0sW5',
    'user_4qS8lN9eZ0hC3dArV5yG1tX6'
  ];

  for (let i = 0; i < sampleDrivers.length; i++) {
    const driver = sampleDrivers[i];
    const userId = clerkUserIds[i];
    await createIfNotExists('DriverProfiles', 'phone', driver.phone, {
      userId,
      ...driver,
    });
  }
}

// ===== 5. SAMPLE SHARED RIDES =====
async function createSharedRides() {
  console.log('\n🚖 Creating shared taxi rides...');
  const existingRides = await databases.listDocuments(DATABASE_ID, 'shared_taxi_rides');
  if (existingRides.total > 0) {
    console.log('  ⏩ Shared rides already exist, skipping creation.');
    return;
  }

  const drivers = await databases.listDocuments(DATABASE_ID, 'DriverProfiles');
  const routes = await databases.listDocuments(DATABASE_ID, 'taxi_routes');
  const routeIds = routes.documents.map(r => r.$id);
  if (routeIds.length === 0) {
    console.log('  ⏩ No routes found, skipping ride creation.');
    return;
  }

  for (const driver of drivers.documents) {
    const rideData = {
      driverId: driver.$id,
      vehicleType: driver.vehicleType,
      vehicleReg: driver.vehicleReg,
      capacity: driver.capacity,
      availableSeats: driver.capacity - Math.floor(Math.random() * (driver.capacity - 1)) - 1,
      routeId: routeIds[Math.floor(Math.random() * routeIds.length)],
      currentLocation: JSON.stringify({ latitude: -26.204, longitude: 28.047 }),
      geohash: 'g7m3w4',
      heading: Math.random() * 360,
      lastUpdate: new Date().toISOString(),
      etaToNextStop: Math.floor(Math.random() * 10) + 2,
      status: 'active'
    };
    await createIfNotExists('shared_taxi_rides', 'driverId', driver.$id, rideData);
  }
}

// ===== MAIN =====
async function run() {
  console.log('🚀 Populating database with sample data...\n');

  // Ensure all required collections exist
  await ensureTaxiRoutesCollection();
  await ensureSharedRidesCollection();

  // Populate data
  await createSampleRoutes();
  await createDrivers();
  await createSharedRides();

  console.log('\n✅ Sample data population complete!');
}

run();