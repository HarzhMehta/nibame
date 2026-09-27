import { NextResponse } from "next/server";

import { authenticateUser, AuthenticationError, createUserSession } from "../../../lib/auth";

interface AuthRequestBody {
  email?: unknown;
  password?: unknown;
}

/** Authenticate a user and begin a persistent session. */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as AuthRequestBody | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: { code: "MISSING_CREDENTIALS", message: "Enter your email and password." } },
      { status: 400 },
    );
  }

  try {
    const user = await authenticateUser(email, password);
    await createUserSession(user.id);
    return NextResponse.json({ data: { email: user.email } });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: { code: "AUTH_UNAVAILABLE", message: "Could not sign in. Try again." } },
      { status: 503 },
    );
  }
}
