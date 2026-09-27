import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../lib/auth";
import { deleteUserLink } from "../../../lib/user-links";

interface RouteContext {
  params: Promise<{ id: string }>;
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
