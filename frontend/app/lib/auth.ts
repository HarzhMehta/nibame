import "server-only";

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import { MongoServerError, ObjectId } from "mongodb";
import { cookies } from "next/headers";

import { getDatabase } from "./mongodb";

const SESSION_COOKIE = "nibame_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

interface UserDocument {
  _id: ObjectId;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionDocument {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthenticatedUser {
  id: ObjectId;
  email: string;
}

export class AuthenticationError extends Error {
  constructor(
    message: string,
    readonly code: "EMAIL_TAKEN" | "INVALID_CREDENTIALS",
  ) {
    super(message);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase();
}

function derivePasswordKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function createPasswordHash(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const key = await derivePasswordKey(password, salt);
  return { hash: key.toString("hex"), salt };
}

async function passwordMatches(
  password: string,
  expectedHash: string,
  salt: string,
): Promise<boolean> {
  const suppliedKey = await derivePasswordKey(password, salt);
  const expectedKey = Buffer.from(expectedHash, "hex");
  return suppliedKey.length === expectedKey.length && timingSafeEqual(suppliedKey, expectedKey);
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a user account with a securely derived password hash. */
export async function registerUser(email: string, password: string): Promise<AuthenticatedUser> {
  const database = await getDatabase();
  const passwordRecord = await createPasswordHash(password);
  const now = new Date();
  const document = {
    email: email.trim(),
    normalizedEmail: normalizeEmail(email),
    passwordHash: passwordRecord.hash,
    passwordSalt: passwordRecord.salt,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await database.collection<Omit<UserDocument, "_id">>("users").insertOne(document);
    return { id: result.insertedId, email: document.email };
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new AuthenticationError("An account already exists for this email.", "EMAIL_TAKEN");
    }
    throw error;
  }
}

/** Authenticate a user with email and password. */
export async function authenticateUser(
  email: string,
  password: string,
): Promise<AuthenticatedUser> {
  const database = await getDatabase();
  const user = await database
    .collection<UserDocument>("users")
    .findOne({ normalizedEmail: normalizeEmail(email) });

  if (!user || !(await passwordMatches(password, user.passwordHash, user.passwordSalt))) {
    throw new AuthenticationError("Email or password is incorrect.", "INVALID_CREDENTIALS");
  }
  return { id: user._id, email: user.email };
}

/** Create a persistent server-side session and set its secure browser cookie. */
export async function createUserSession(userId: ObjectId): Promise<void> {
  const database = await getDatabase();
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_SECONDS * 1000);
  const session: Omit<SessionDocument, "_id"> = {
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    createdAt: now,
  };

  await database.collection<Omit<SessionDocument, "_id">>("sessions").insertOne(session);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

/** Return the user attached to the current unexpired session. */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const database = await getDatabase();
  const session = await database.collection<SessionDocument>("sessions").findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;

  const user = await database.collection<UserDocument>("users").findOne(
    { _id: session.userId },
    { projection: { email: 1 } },
  );
  return user ? { id: user._id, email: user.email } : null;
}

/** Delete the current server-side session and expire its browser cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const database = await getDatabase();
    await database.collection<SessionDocument>("sessions").deleteOne({
      tokenHash: hashSessionToken(token),
    });
  }
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
