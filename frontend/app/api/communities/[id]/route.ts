import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../lib/auth";
import { CommunityError, setCommunityArchived } from "../../../lib/community-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdateCommunityBody {
  archived?: unknown;
}

/** Archive or restore a community only as super admin. */
export async function PATCH(
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
  const body = (await request.json().catch(() => null)) as UpdateCommunityBody | null;
  if (typeof body?.archived !== "boolean") {
    return NextResponse.json(
      { error: { code: "INVALID_ACTION", message: "Choose archive or restore." } },
      { status: 400 },
    );
  }
  try {
    const { id } = await context.params;
    await setCommunityArchived(user, id, body.archived);
    return NextResponse.json({ data: { archived: body.archived } });
  } catch (error) {
    if (error instanceof CommunityError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "FORBIDDEN" ? 403 : 404 },
      );
    }
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: "Could not update this community." } },
      { status: 503 },
    );
  }
}
