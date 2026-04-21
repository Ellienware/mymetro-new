// scripts/add-school-booking-attributes.js
// scripts/add-period-attribute.js
// scripts/add-school-booking-attributes.js
import { Client, Databases } from 'node-appwrite';

const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
const PROJECT_ID = '68505b630015642e04c9';
const API_KEY = 'standard_ca5b461f88bc2f9d5f5a7e3eb22f11d4b3104b83829353cbb8f55817f32dfd06d43b149202fe332fd323dea13ae6284dcfc1fc3ab6ad5da8f9c89e77ea655536c97bed5044e3a721d013992e3107ccd4aa0116656c4d5777a43d097032ecd22a271a1c3776f272a66c959e5f41c3232103844e7d7799b735a95cd50268651521';
const DATABASE_ID = '68505be8001a90ec85ed';

if (!PROJECT_ID || !API_KEY || !DATABASE_ID) {
  console.error('Missing environment variables');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

async function addAttribute(collectionId, type, key, options = {}) {
  try {
    const required = options.required ?? false;
    const defaultValue = options.default;
    const array = options.array ?? false;
    const size = options.size || 256;
    const min = options.min ?? null;
    const max = options.max ?? null;

    switch (type) {
      case 'string':
        await databases.createStringAttribute(DATABASE_ID, collectionId, key, size, required, defaultValue, array);
        break;
      case 'integer':
        await databases.createIntegerAttribute(DATABASE_ID, collectionId, key, required, min, max, defaultValue, array);
        break;
      case 'float':
        await databases.createFloatAttribute(DATABASE_ID, collectionId, key, required, min, max, defaultValue, array);
        break;
      case 'boolean':
        await databases.createBooleanAttribute(DATABASE_ID, collectionId, key, required, defaultValue, array);
        break;
      case 'enum':
        await databases.createEnumAttribute(DATABASE_ID, collectionId, key, options.elements, required, defaultValue, array);
        break;
      default:
        throw new Error(`Unsupported type: ${type}`);
    }
    console.log(`✅ Added attribute ${key} (${type}) to ${collectionId}`);
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log(`⏩ Attribute ${key} already exists in ${collectionId}`);
    } else {
      console.error(`❌ Failed to add attribute ${key}:`, err.message);
    }
  }
}

async function main() {
  console.log('🚀 Adding missing attributes to SCHOOL_BOOKINGS...\n');

  const attributes = [
    { key: 'parentId', type: 'string', options: { required: false, size: 36 } },
    { key: 'offeringId', type: 'string', options: { required: false, size: 36 } },
    { key: 'routeId', type: 'string', options: { required: false, size: 36 } },
    { key: 'selectedSchool', type: 'string', options: { required: false, size: 255 } },
    { key: 'period', type: 'enum', options: { required: false, elements: ['weekly', 'monthly'], default: null } },
    { key: 'childIds', type: 'string', options: { required: false, size: 1024 } },
    { key: 'childNames', type: 'string', options: { required: false, size: 1024 } },
    { key: 'pickupAddress', type: 'string', options: { required: false, size: 512 } },
    { key: 'homeLat', type: 'float', options: { required: false } },
    { key: 'homeLng', type: 'float', options: { required: false } },
    { key: 'startDate', type: 'string', options: { required: false, size: 50 } },
    { key: 'endDate', type: 'string', options: { required: false, size: 50 } },
    { key: 'totalAmount', type: 'float', options: { required: false } },
    { key: 'paymentStatus', type: 'string', options: { required: false, size: 50 } },
    { key: 'status', type: 'string', options: { required: false, size: 50 } },
    { key: 'createdAt', type: 'string', options: { required: false, size: 50 } },
  ];

  for (const attr of attributes) {
    await addAttribute('SCHOOL_BOOKINGS', attr.type, attr.key, attr.options);
  }

  console.log('\n✅ All attributes processed!');
}

main().catch(console.error);