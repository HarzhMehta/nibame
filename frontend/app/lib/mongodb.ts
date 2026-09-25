import "server-only";

import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB ?? "nibame";

if (!uri) throw new Error("MONGODB_URI is not configured.");
const mongoUri: string = uri;

declare global {
  var nibameMongoClient: Promise<MongoClient> | undefined;
  var nibameMongoIndexes: Promise<void> | undefined;
}

/** Return the shared MongoDB client used by server-side code. */
export function getMongoClient(): Promise<MongoClient> {
  if (!global.nibameMongoClient) {
    global.nibameMongoClient = new MongoClient(mongoUri).connect();
  }
  return global.nibameMongoClient;
}

async function ensureIndexes(database: Db): Promise<void> {
  await Promise.all([
    database.collection("users").createIndex({ normalizedEmail: 1 }, { unique: true }),
    database.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    database.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection("custom_categories").createIndex(
      { userId: 1, normalizedLabel: 1 },
      { unique: true },
    ),
    database.collection("custom_categories").createIndex(
      { userId: 1, id: 1 },
      { unique: true },
    ),
    database.collection("domain_rules").createIndex(
      { userId: 1, domain: 1 },
      { unique: true },
    ),
    database.collection("links").createIndex(
      { userId: 1, normalizedUrl: 1 },
      { unique: true },
    ),
    database.collection("links").createIndex({ userId: 1, updatedAt: -1 }),
    database.collection("links").createIndex({ userId: 1, categoryId: 1, updatedAt: -1 }),
  ]);
}

/** Return the application database after its required indexes exist. */
export async function getDatabase(): Promise<Db> {
  const client = await getMongoClient();
  const database = client.db(databaseName);
  if (!global.nibameMongoIndexes) {
    global.nibameMongoIndexes = ensureIndexes(database);
  }
  await global.nibameMongoIndexes;
  return database;
}
