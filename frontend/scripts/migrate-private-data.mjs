import {
  createCipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const CONFIRMED = process.argv.includes("--confirm=ENCRYPT_PRIVATE_DATA");
const PREFIX = "enc:v1";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB ?? "nibame";
const encodedMasterKey = process.env.NIBAME_DATA_ENCRYPTION_KEY;

if (!uri) throw new Error("MONGODB_URI is not configured.");
if (!encodedMasterKey) throw new Error("NIBAME_DATA_ENCRYPTION_KEY is not configured.");
if (APPLY && !CONFIRMED) {
  throw new Error("Apply mode requires --confirm=ENCRYPT_PRIVATE_DATA.");
}

const masterKey = Buffer.from(encodedMasterKey, "base64");
if (masterKey.length !== 32) {
  throw new Error("NIBAME_DATA_ENCRYPTION_KEY must be 32 base64-encoded bytes.");
}

const encryptionKey = Buffer.from(
  hkdfSync("sha256", masterKey, Buffer.alloc(0), "nibame:data:v1", 32),
);
const lookupKey = Buffer.from(
  hkdfSync("sha256", masterKey, Buffer.alloc(0), "nibame:lookup:v1", 32),
);

function encrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX + ":");
}

function encryptString(value, purpose) {
  if (encrypted(value)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  cipher.setAAD(Buffer.from(purpose, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    PREFIX,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

function encryptJson(value, purpose) {
  return encryptString(JSON.stringify(value), purpose);
}

function blindIndex(purpose, value) {
  return `idx:v1:${createHmac("sha256", lookupKey)
    .update(purpose)
    .update("\0")
    .update(value)
    .digest("base64url")}`;
}

function userUpdate(user) {
  if (encrypted(user.email) && user.emailLookup) return null;
  const email = String(user.email ?? "").trim();
  if (!email) return null;
  const emailLookup = blindIndex("user.email", email.toLocaleLowerCase());
  return {
    updateOne: {
      filter: { _id: user._id },
      update: {
        $set: {
          email: encryptString(email, "user.email"),
          normalizedEmail: emailLookup,
          emailLookup,
          updatedAt: new Date(),
        },
      },
    },
  };
}

function linkUpdate(link) {
  if (encrypted(link.privateData) && link.urlLookup && link.ruleLookup) return null;
  const normalizedUrl = String(link.normalizedUrl ?? "");
  const ruleDomain = String(link.ruleDomain ?? "");
  if (!normalizedUrl || !ruleDomain) return null;
  const urlLookup = blindIndex("link.url", normalizedUrl);
  const ruleLookup = blindIndex("domain.rule", ruleDomain);
  return {
    updateOne: {
      filter: { _id: link._id },
      update: {
        $set: {
          normalizedUrl: urlLookup,
          ruleDomain: ruleLookup,
          urlLookup,
          ruleLookup,
          privateData: encryptJson(
            {
              originalUrl: String(link.originalUrl ?? normalizedUrl),
              normalizedUrl,
              domain: String(link.domain ?? ""),
              ruleDomain,
              categoryLabel: String(link.categoryLabel ?? "Uncategorized"),
              title: link.title,
              description: link.description,
              imageUrl: link.imageUrl,
              faviconUrl: link.faviconUrl,
              sourceName: link.sourceName,
              userDescription: link.userDescription,
              metadata: link.metadata,
            },
            "link.privateData",
          ),
          updatedAt: new Date(),
        },
        $unset: {
          originalUrl: "",
          domain: "",
          categoryLabel: "",
          title: "",
          description: "",
          imageUrl: "",
          faviconUrl: "",
          sourceName: "",
          userDescription: "",
          metadata: "",
        },
      },
    },
  };
}

function itemUpdate(item) {
  if (encrypted(item.privateData)) return null;
  return {
    updateOne: {
      filter: { _id: item._id },
      update: {
        $set: {
          privateData: encryptJson(
            {
              text: String(item.text ?? ""),
              timezone: String(item.timezone ?? "UTC"),
              categoryId: item.categoryId,
            },
            "item.privateData",
          ),
          updatedAt: new Date(),
        },
        $unset: { text: "", timezone: "", categoryId: "" },
      },
    },
  };
}

function categoryUpdate(category) {
  if (encrypted(category.privateData) && category.normalizedLabelLookup) return null;
  const label = String(category.label ?? "Custom category");
  const normalizedLabelLookup = blindIndex("category.label", label.trim().toLocaleLowerCase());
  return {
    updateOne: {
      filter: { _id: category._id },
      update: {
        $set: {
          normalizedLabel: normalizedLabelLookup,
          normalizedLabelLookup,
          privateData: encryptJson(
            {
              label,
              domains: category.domains ?? [],
              examples: category.examples ?? [],
            },
            "category.privateData",
          ),
          updatedAt: new Date(),
        },
        $unset: { label: "", domains: "", examples: "" },
      },
    },
  };
}

function ruleUpdate(rule) {
  if (encrypted(rule.privateData) && rule.domainLookup) return null;
  const domain = String(rule.domain ?? "");
  if (!domain) return null;
  const domainLookup = blindIndex("domain.rule", domain);
  return {
    updateOne: {
      filter: { _id: rule._id },
      update: {
        $set: {
          domain: domainLookup,
          domainLookup,
          privateData: encryptJson({ domain }, "domainRule.privateData"),
          updatedAt: new Date(),
        },
      },
    },
  };
}

async function migrateCollection(database, collectionName, mapper) {
  const documents = await database.collection(collectionName).find({}).toArray();
  const operations = documents.map(mapper).filter(Boolean);
  if (APPLY && operations.length) {
    await database.collection(collectionName).bulkWrite(operations, { ordered: false });
  }
  return { scanned: documents.length, pending: operations.length };
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const database = client.db(databaseName);
  const results = {
    users: await migrateCollection(database, "users", userUpdate),
    links: await migrateCollection(database, "links", linkUpdate),
    items: await migrateCollection(database, "items", itemUpdate),
    categories: await migrateCollection(database, "custom_categories", categoryUpdate),
    domainRules: await migrateCollection(database, "domain_rules", ruleUpdate),
  };
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", results }));
} finally {
  await client.close();
}
