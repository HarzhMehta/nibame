import { NextResponse } from "next/server";

import { getCurrentUser } from "../../lib/auth";
import { LinkError, saveUserLink } from "../../lib/user-links";

interface LinkRequestBody {
  url?: unknown;
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
