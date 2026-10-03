import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../../lib/auth";
import {
  CommunityError,
  importCommunityPost,
} from "../../../../lib/community-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ImportBody {
  timezone?: unknown;
}

/** Import one joined-community post into the current user's private profile. */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }
  const body = (await request.json().catch(() => null)) as ImportBody | null;
  try {
    const { id } = await context.params;
    const imported = await importCommunityPost(
      user.id,
      id,
      typeof body?.timezone === "string" ? body.timezone : "UTC",
    );
    return NextResponse.json({ data: { imported } });
  } catch (error) {
    if (error instanceof CommunityError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "NOT_JOINED" ? 403 : 404 },
      );
    }
    return NextResponse.json(
      { error: { code: "IMPORT_FAILED", message: "Could not import this item." } },
      { status: 503 },
    );
  }
}
