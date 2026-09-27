import { NextResponse } from "next/server";

import { destroyCurrentSession } from "../../../lib/auth";

/** End the current session and return to login. */
export async function POST(request: Request): Promise<NextResponse> {
  await destroyCurrentSession();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
