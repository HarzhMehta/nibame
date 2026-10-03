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
    database.collection("users").createIndex(
      { emailLookup: 1 },
      { unique: true, partialFilterExpression: { emailLookup: { $type: "string" } } },
    ),
    database.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    database.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection("custom_categories").createIndex(
      { userId: 1, normalizedLabel: 1 },
      { unique: true },
    ),
    database.collection("custom_categories").createIndex(
      { userId: 1, normalizedLabelLookup: 1 },
      {
        unique: true,
        partialFilterExpression: { normalizedLabelLookup: { $type: "string" } },
      },
    ),
    database.collection("custom_categories").createIndex(
      { userId: 1, id: 1 },
      { unique: true },
    ),
    database.collection("domain_rules").createIndex(
      { userId: 1, domain: 1 },
      { unique: true },
    ),
    database.collection("domain_rules").createIndex(
      { userId: 1, domainLookup: 1 },
      { unique: true, partialFilterExpression: { domainLookup: { $type: "string" } } },
    ),
    database.collection("links").createIndex(
      { userId: 1, normalizedUrl: 1 },
      { unique: true },
    ),
    database.collection("links").createIndex(
      { userId: 1, urlLookup: 1 },
      { unique: true, partialFilterExpression: { urlLookup: { $type: "string" } } },
    ),
    database.collection("links").createIndex({ userId: 1, updatedAt: -1 }),
    database.collection("links").createIndex({ userId: 1, categoryId: 1, updatedAt: -1 }),
    database.collection("links").createIndex({ userId: 1, state: 1, updatedAt: -1 }),
    database.collection("links").createIndex({ userId: 1, intent: 1, updatedAt: -1 }),
    database.collection("items").createIndex({ userId: 1, status: 1, updatedAt: -1 }),
    database.collection("items").createIndex({ userId: 1, remindAt: 1 }),
    database.collection("auth_rate_limits").createIndex({ key: 1 }, { unique: true }),
    database.collection("auth_rate_limits").createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    ),
    database.collection("communities").createIndex({ slug: 1 }, { unique: true }),
    database.collection("communities").createIndex({ status: 1, createdAt: -1 }),
    database.collection("community_memberships").createIndex(
      { communityId: 1, userId: 1 },
      { unique: true },
    ),
    database.collection("community_memberships").createIndex({ userId: 1, joinedAt: -1 }),
    database.collection("community_posts").createIndex({ communityId: 1, createdAt: -1 }),
    database.collection("community_posts").createIndex({ authorId: 1, createdAt: -1 }),
    database.collection("items").createIndex(
      { userId: 1, sourceCommunityPostId: 1 },
      {
        unique: true,
        partialFilterExpression: { sourceCommunityPostId: { $type: "string" } },
      },
    ),
  ]);
}

/** Return the shared database and maintain indexes outside the production request path. */
export async function getDatabase(): Promise<Db> {
  const client = await getMongoClient();
  const database = client.db(databaseName);
  if (!global.nibameMongoIndexes) {
    global.nibameMongoIndexes = ensureIndexes(database).catch((error: unknown) => {
      global.nibameMongoIndexes = undefined;
      console.error("MongoDB index maintenance failed.", error);
    });
  }
  if (process.env.NODE_ENV !== "production") await global.nibameMongoIndexes;
  return database;
}
