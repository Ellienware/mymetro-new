import { Client, Databases } from 'node-appwrite';

export function createDB() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
  return new Databases(client);
}

export const DATABASE_ID = process.env.DATABASE_ID;