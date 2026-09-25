import { NextResponse } from "next/server";

import { AuthenticationError, createUserSession, registerUser } from "../../../lib/auth";

interface AuthRequestBody {
  email?: unknown;
  password?: unknown;
}

/** Register a user and begin a persistent session. */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as AuthRequestBody | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { error: { code: "INVALID_EMAIL", message: "Enter a valid email address." } },
      { status: 400 },
    );
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: { code: "INVALID_PASSWORD", message: "Use a password between 8 and 128 characters." } },
      { status: 400 },
    );
  }

  try {
    const user = await registerUser(email, password);
    await createUserSession(user.id);
    return NextResponse.json({ data: { email: user.email } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError && error.code === "EMAIL_TAKEN") {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: { code: "AUTH_UNAVAILABLE", message: "Could not create the account. Try again." } },
      { status: 503 },
    );
  }
}
