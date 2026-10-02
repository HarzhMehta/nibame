import { NextResponse } from "next/server";

import { getCurrentUser } from "../../lib/auth";
import type { UserItemKind } from "../../lib/item-types";
import {
  createUserItem,
  getUserItems,
  UserItemError,
} from "../../lib/user-items";

interface CreateItemBody {
  kind?: unknown;
  text?: unknown;
  remindAt?: unknown;
  timezone?: unknown;
}

/** Return the authenticated user's tasks and notes. */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }
  return NextResponse.json({ data: { items: await getUserItems(user.id) } });
}

/** Create one explicit task or note for the authenticated user. */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as CreateItemBody | null;
  try {
    const item = await createUserItem(user.id, {
      kind: body?.kind as UserItemKind,
      text: typeof body?.text === "string" ? body.text : "",
      remindAt: typeof body?.remindAt === "string" ? body.remindAt : undefined,
      timezone: typeof body?.timezone === "string" ? body.timezone : "UTC",
    });
    return NextResponse.json({ data: { item } }, { status: 201 });
  } catch (error) {
    if (error instanceof UserItemError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "SAVE_FAILED", message: "Could not save this item. Try again." } },
      { status: 503 },
    );
  }
}
