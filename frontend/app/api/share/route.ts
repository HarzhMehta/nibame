import { NextResponse } from "next/server";

import { getCurrentUser } from "../../lib/auth";
import { saveUserLink } from "../../lib/user-links";
import { parseUrl } from "../../lib/url-categorizer";

function extractSharedUrl(values: Array<FormDataEntryValue | null>): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const direct = value.trim();
    if (parseUrl(direct)) return direct;
    const match = direct.match(/https?:\/\/[^\s]+/i);
    if (match && parseUrl(match[0])) return match[0];
  }
  return null;
}

/** Receive a URL from an installed app's system share sheet. */
export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData();
  const sharedUrl = extractSharedUrl([
    formData.get("url"),
    formData.get("text"),
    formData.get("title"),
  ]);
  if (!sharedUrl) return NextResponse.redirect(new URL("/", request.url), 303);

  const user = await getCurrentUser();
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("shared", sharedUrl.slice(0, 2048));
    return NextResponse.redirect(loginUrl, 303);
  }

  await saveUserLink(user.id, sharedUrl);
  return NextResponse.redirect(new URL("/", request.url), 303);
}
