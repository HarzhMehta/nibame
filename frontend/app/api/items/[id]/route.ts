import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../lib/auth";
import {
  deleteUserItem,
  updateUserItem,
  type UserItemAction,
  UserItemError,
} from "../../../lib/user-items";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdateItemBody {
  action?: unknown;
}

/** Complete, reopen, or archive an owned item. */
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
  const body = (await request.json().catch(() => null)) as UpdateItemBody | null;
  const action = body?.action;
  if (action !== "complete" && action !== "reopen" && action !== "archive") {
    return NextResponse.json(
      { error: { code: "INVALID_ACTION", message: "Choose a valid item action." } },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    return NextResponse.json({
      data: { item: await updateUserItem(user.id, id, action as UserItemAction) },
    });
  } catch (error) {
    if (error instanceof UserItemError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: "Could not update this item." } },
      { status: 503 },
    );
  }
}

/** Delete one task or note owned by the authenticated user. */
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
  if (!(await deleteUserItem(user.id, id))) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Item not found." } },
      { status: 404 },
    );
  }
  return new NextResponse(null, { status: 204 });
}
