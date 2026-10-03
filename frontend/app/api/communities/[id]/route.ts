import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../lib/auth";
import {
  CommunityError,
  setCommunityArchived,
  updateCommunityDescription,
} from "../../../lib/community-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdateCommunityBody {
  archived?: unknown;
  description?: unknown;
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
  if (typeof body?.archived !== "boolean" && typeof body?.description !== "string") {
    return NextResponse.json(
      { error: { code: "INVALID_ACTION", message: "Choose a valid community update." } },
      { status: 400 },
    );
  }
  try {
    const { id } = await context.params;
    if (typeof body.description === "string") {
      const description = await updateCommunityDescription(user, id, body.description);
      return NextResponse.json({ data: { description } });
    }
    const archived = body.archived as boolean;
    await setCommunityArchived(user, id, archived);
    return NextResponse.json({ data: { archived } });
  } catch (error) {
    if (error instanceof CommunityError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        {
          status:
            error.code === "FORBIDDEN"
              ? 403
              : error.code === "INVALID_COMMUNITY"
                ? 400
                : 404,
        },
      );
    }
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: "Could not update this community." } },
      { status: 503 },
    );
  }
}
