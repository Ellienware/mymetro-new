import { Client, Databases } from 'node-appwrite';

// ===== CONFIGURE THESE =====
const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1'; // or your self‑hosted URL
const PROJECT_ID = "68505b630015642e04c9";
const API_KEY = 'standard_ca5b461f88bc2f9d5f5a7e3eb22f11d4b3104b83829353cbb8f55817f32dfd06d43b149202fe332fd323dea13ae6284dcfc1fc3ab6ad5da8f9c89e77ea655536c97bed5044e3a721d013992e3107ccd4aa0116656c4d5777a43d097032ecd22a271a1c3776f272a66c959e5f41c3232103844e7d7799b735a95cd50268651521';
const DATABASE_ID = "68505be8001a90ec85ed";
// ===========================


const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

// Define expected collections (case-insensitive)
const expectedCollections = [
  'Users', 'Wallets', 'Transactions', 'Tickets', 'Favorites', 'Payment Methods',
  'Loans', 'Metrobus_Trips', 'Rea_Vaya_Trips' // new ones we'll create
];

async function listCollections() {
  try {
    const collectionsResponse = await databases.listCollections(DATABASE_ID);
    const existingNames = collectionsResponse.collections.map(c => c.name);
    
    console.log(`\n📁 Found ${existingNames.length} collection(s):\n`);
    existingNames.forEach(name => console.log(`  - ${name}`));
    console.log('\n');

    // Check which expected collections are missing
    const missing = expectedCollections.filter(expected => 
      !existingNames.some(existing => existing.toLowerCase() === expected.toLowerCase())
    );
    
    if (missing.length) {
      console.log('❌ Missing collections:');
      missing.forEach(name => console.log(`  - ${name}`));
    } else {
      console.log('✅ All expected collections present.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listCollections();