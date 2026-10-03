import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const CIPHERTEXT_PREFIX = "enc:v1";
const LOOKUP_PREFIX = "idx:v1";

let cachedEncryptionKey: Buffer | undefined;
let cachedLookupKey: Buffer | undefined;

function masterKey(): Buffer {
  const encoded = process.env.NIBAME_DATA_ENCRYPTION_KEY;
  if (!encoded) throw new Error("NIBAME_DATA_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("NIBAME_DATA_ENCRYPTION_KEY must be 32 base64-encoded bytes.");
  }
  return key;
}

/** Return whether server-side private-data encryption is configured. */
export function dataEncryptionConfigured(): boolean {
  return Boolean(process.env.NIBAME_DATA_ENCRYPTION_KEY);
}

function encryptionKey(): Buffer {
  if (!cachedEncryptionKey) {
    cachedEncryptionKey = Buffer.from(
      hkdfSync("sha256", masterKey(), Buffer.alloc(0), "nibame:data:v1", 32),
    );
  }
  return cachedEncryptionKey;
}

function lookupKey(): Buffer {
  if (!cachedLookupKey) {
    cachedLookupKey = Buffer.from(
      hkdfSync("sha256", masterKey(), Buffer.alloc(0), "nibame:lookup:v1", 32),
    );
  }
  return cachedLookupKey;
}

/** Return whether a value uses Nibame's versioned ciphertext format. */
export function isEncryptedValue(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(CIPHERTEXT_PREFIX + ":");
}

/** Encrypt one UTF-8 string with randomized AES-256-GCM. */
export function encryptString(value: string, purpose: string): string {
  if (isEncryptedValue(value)) return value;
  if (!dataEncryptionConfigured()) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(purpose, "utf8"));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    CIPHERTEXT_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

/** Decrypt one versioned value while accepting legacy plaintext during migration. */
export function decryptString(value: string, purpose: string): string {
  if (!isEncryptedValue(value)) return value;
  const parts = value.split(":");
  if (parts.length !== 5) throw new Error("Encrypted data has an invalid format.");
  const iv = Buffer.from(parts[2], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  const encrypted = Buffer.from(parts[4], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAAD(Buffer.from(purpose, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** Encrypt a JSON-compatible private payload. */
export function encryptJson(value: unknown, purpose: string): string {
  return encryptString(JSON.stringify(value), purpose);
}

/** Decrypt a JSON-compatible private payload. */
export function decryptJson<T>(value: string, purpose: string): T {
  return JSON.parse(decryptString(value, purpose)) as T;
}

/** Build a deterministic keyed lookup without exposing the original value. */
export function blindIndex(purpose: string, value: string): string {
  if (!dataEncryptionConfigured()) return value;
  const digest = createHmac("sha256", lookupKey())
    .update(purpose)
    .update("\0")
    .update(value)
    .digest("base64url");
  return `${LOOKUP_PREFIX}:${digest}`;
}

/** Return the server-only pepper used for password hashing. */
export function passwordPepper(): string | null {
  const encoded = process.env.NIBAME_PASSWORD_PEPPER;
  if (!encoded) return null;
  const pepper = Buffer.from(encoded, "base64");
  if (pepper.length !== 32) {
    throw new Error("NIBAME_PASSWORD_PEPPER must be 32 base64-encoded bytes.");
  }
  return encoded;
}
