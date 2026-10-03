import { NextResponse } from "next/server";

import { destroyCurrentSession } from "../../../lib/auth";

/** End the current session and return to the public landing page. */
export async function POST(request: Request): Promise<NextResponse> {
  await destroyCurrentSession();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
