import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../lib/auth";
import {
  deleteUserLink,
  LinkError,
  updateLinkActivity,
  type LinkActivityAction,
} from "../../../lib/user-links";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ActivityRequestBody {
  action?: unknown;
}

/** Record an open, later, or archive action for one owned link. */
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

  const body = (await request.json().catch(() => null)) as ActivityRequestBody | null;
  const action = body?.action;
  if (action !== "open" && action !== "later" && action !== "archive") {
    return NextResponse.json(
      { error: { code: "INVALID_ACTION", message: "Choose a valid link action." } },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const link = await updateLinkActivity(user.id, id, action as LinkActivityAction);
    return NextResponse.json({ data: { link } });
  } catch (error) {
    if (error instanceof LinkError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: "Could not update this link." } },
      { status: 503 },
    );
  }
}

/** Delete one saved link owned by the authenticated user. */
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
  if (!(await deleteUserLink(user.id, id))) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Link not found." } },
      { status: 404 },
    );
  }
  return new NextResponse(null, { status: 204 });
}
