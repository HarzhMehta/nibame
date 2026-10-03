import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../../lib/auth";
import {
  CommunityError,
  joinCommunity,
  leaveCommunity,
} from "../../../../lib/community-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Join an open community. */
export async function POST(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }
  try {
    const { id } = await context.params;
    await joinCommunity(user.id, id);
    return NextResponse.json({ data: { joined: true } });
  } catch (error) {
    if (error instanceof CommunityError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: { code: "JOIN_FAILED", message: "Could not join this community." } },
      { status: 503 },
    );
  }
}

/** Leave a community without removing authored posts. */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }
  const { id } = await context.params;
  await leaveCommunity(user.id, id);
  return new NextResponse(null, { status: 204 });
}
