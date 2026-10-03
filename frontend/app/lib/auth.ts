import "server-only";

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import { MongoServerError, ObjectId } from "mongodb";
import { cookies } from "next/headers";

import {
  blindIndex,
  decryptString,
  encryptString,
  passwordPepper,
} from "./data-encryption";
import { getDatabase } from "./mongodb";

const SESSION_COOKIE = "nibame_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

interface UserDocument {
  _id: ObjectId;
  email: string;
  normalizedEmail?: string;
  emailLookup?: string;
  passwordHash: string;
  passwordSalt: string;
  passwordVersion?: number;
  createdAt: Date;
  updatedAt: Date;
  isSuperAdmin?: boolean;
}

interface SessionDocument {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

interface SessionUserDocument {
  user: Pick<UserDocument, "_id" | "email" | "isSuperAdmin">;
}

export interface AuthenticatedUser {
  id: ObjectId;
  email: string;
  isSuperAdmin: boolean;
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

function derivePasswordKey(password: string, salt: string, version = 2): Promise<Buffer> {
  const pepper = passwordPepper();
  if (version >= 2 && !pepper) {
    throw new Error("NIBAME_PASSWORD_PEPPER is required for this password hash.");
  }
  const passwordMaterial = version >= 2 ? `${password}\0${pepper}` : password;
  return new Promise((resolve, reject) => {
    scrypt(passwordMaterial, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function createPasswordHash(
  password: string,
): Promise<{ hash: string; salt: string; version: number }> {
  const salt = randomBytes(16).toString("hex");
  const version = passwordPepper() ? 2 : 1;
  const key = await derivePasswordKey(password, salt, version);
  return { hash: key.toString("hex"), salt, version };
}

async function passwordMatches(
  password: string,
  expectedHash: string,
  salt: string,
  version: number,
): Promise<boolean> {
  const suppliedKey = await derivePasswordKey(password, salt, version);
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
  const normalizedEmail = normalizeEmail(email);
  const emailLookup = blindIndex("user.email", normalizedEmail);
  const displayEmail = email.trim();
  const document = {
    email: encryptString(displayEmail, "user.email"),
    normalizedEmail: emailLookup,
    emailLookup,
    passwordHash: passwordRecord.hash,
    passwordSalt: passwordRecord.salt,
    passwordVersion: passwordRecord.version,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await database.collection<Omit<UserDocument, "_id">>("users").insertOne(document);
    return { id: result.insertedId, email: displayEmail, isSuperAdmin: false };
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
  const normalizedEmail = normalizeEmail(email);
  const emailLookup = blindIndex("user.email", normalizedEmail);
  const user = await database
    .collection<UserDocument>("users")
    .findOne({
      $or: [
        { emailLookup },
        { normalizedEmail },
      ],
    });

  const passwordVersion = user?.passwordVersion ?? 1;
  if (
    !user ||
    !(await passwordMatches(password, user.passwordHash, user.passwordSalt, passwordVersion))
  ) {
    throw new AuthenticationError("Email or password is incorrect.", "INVALID_CREDENTIALS");
  }
  const displayEmail = decryptString(user.email, "user.email");
  const shouldUpgradePassword = passwordVersion < 2 && Boolean(passwordPepper());
  if (shouldUpgradePassword || !user.emailLookup) {
    const upgradedPassword = shouldUpgradePassword
      ? await createPasswordHash(password)
      : null;
    await database.collection<UserDocument>("users").updateOne(
      { _id: user._id },
      {
        $set: {
          email: encryptString(displayEmail, "user.email"),
          normalizedEmail: emailLookup,
          emailLookup,
          ...(upgradedPassword
            ? {
                passwordHash: upgradedPassword.hash,
                passwordSalt: upgradedPassword.salt,
                passwordVersion: upgradedPassword.version,
              }
            : {}),
          updatedAt: new Date(),
        },
      },
    );
  }
  return { id: user._id, email: displayEmail, isSuperAdmin: user.isSuperAdmin === true };
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
  const session = await database
    .collection<SessionDocument>("sessions")
    .aggregate<SessionUserDocument>([
      {
        $match: {
          tokenHash: hashSessionToken(token),
          expiresAt: { $gt: new Date() },
        },
      },
      { $limit: 1 },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          "user._id": 1,
          "user.email": 1,
          "user.isSuperAdmin": 1,
        },
      },
    ])
    .next();
  const user = session?.user;
  return user
    ? {
        id: user._id,
        email: decryptString(user.email, "user.email"),
        isSuperAdmin: user.isSuperAdmin === true,
      }
    : null;
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
