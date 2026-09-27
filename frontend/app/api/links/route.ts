import { after, NextResponse } from "next/server";

import { getCurrentUser } from "../../lib/auth";
import { enrichUserLink, getUserLinks, LinkError, saveUserLink } from "../../lib/user-links";

export const runtime = "nodejs";
export const maxDuration = 15;

interface LinkRequestBody {
  url?: unknown;
}

/** Return the authenticated user's current link library. */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }
  const links = await getUserLinks(user.id);
  for (const link of links
    .filter(
      (candidate) =>
        candidate.metadataStatus === "pending" || candidate.metadataStatus === "processing",
    )
    .slice(0, 4)) {
    after(() => enrichUserLink(user.id, link.id));
  }
  return NextResponse.json({ data: { links } });
}

/** Categorize and persist one link for the authenticated user. */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as LinkRequestBody | null;
  const url = typeof body?.url === "string" ? body.url : "";
  try {
    const link = await saveUserLink(user.id, url);
    after(() => enrichUserLink(user.id, link.id));
    return NextResponse.json({ data: { link } }, { status: 201 });
  } catch (error) {
    if (error instanceof LinkError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "INVALID_URL" ? 400 : 404 },
      );
    }
    return NextResponse.json(
      { error: { code: "SAVE_FAILED", message: "Could not save this link. Try again." } },
      { status: 503 },
    );
  }
}
