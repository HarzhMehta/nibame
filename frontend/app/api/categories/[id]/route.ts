import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../lib/auth";
import { deleteUserCategory, PreferenceError } from "../../../lib/user-preferences";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Delete one custom category owned by the authenticated user. */
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
  try {
    await deleteUserCategory(user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof PreferenceError && error.code === "CATEGORY_NOT_FOUND") {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: { code: "DELETE_FAILED", message: "Could not delete this category. Try again." } },
      { status: 503 },
    );
  }
}
