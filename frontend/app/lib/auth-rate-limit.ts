import "server-only";

import { createHash } from "node:crypto";

import { getDatabase } from "./mongodb";

interface RateLimitDocument {
  key: string;
  count: number;
  windowStartedAt: Date;
  expiresAt: Date;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function requestAddress(request: Request): string {
  return (
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    "unknown"
  ).trim();
}

function rateLimitKey(scope: string, request: Request, identifier: string): string {
  const value = scope + "|" + requestAddress(request) + "|" + identifier.toLocaleLowerCase();
  return createHash("sha256").update(value).digest("hex");
}

/** Consume one authentication attempt and report whether it is allowed. */
export async function consumeAuthAttempt(
  scope: "login" | "register",
  request: Request,
  identifier: string,
): Promise<boolean> {
  const database = await getDatabase();
  const collection = database.collection<RateLimitDocument>("auth_rate_limits");
  const key = rateLimitKey(scope, request, identifier);
  const now = new Date();
  const existing = await collection.findOne({ key });

  if (!existing || now.getTime() - existing.windowStartedAt.getTime() >= WINDOW_MS) {
    await collection.updateOne(
      { key },
      {
        $set: {
          count: 1,
          windowStartedAt: now,
          expiresAt: new Date(now.getTime() + WINDOW_MS * 2),
        },
      },
      { upsert: true },
    );
    return true;
  }
  if (existing.count >= MAX_ATTEMPTS) return false;
  await collection.updateOne({ key }, { $inc: { count: 1 } });
  return true;
}

/** Clear failed-attempt state following successful authentication. */
export async function clearAuthAttempts(
  scope: "login" | "register",
  request: Request,
  identifier: string,
): Promise<void> {
  const database = await getDatabase();
  await database.collection<RateLimitDocument>("auth_rate_limits").deleteOne({
    key: rateLimitKey(scope, request, identifier),
  });
}
