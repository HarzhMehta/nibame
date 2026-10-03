import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../lib/auth";
import {
  CommunityError,
  deleteCommunityPost,
  updateCommunityPost,
} from "../../../lib/community-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdatePostBody {
  text?: unknown;
  categoryId?: unknown;
}

/** Edit only the authenticated author's own post. */
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
  const body = (await request.json().catch(() => null)) as UpdatePostBody | null;
  try {
    const { id } = await context.params;
    const post = await updateCommunityPost(user.id, id, {
      text: typeof body?.text === "string" ? body.text : "",
      categoryId: typeof body?.categoryId === "string" ? body.categoryId : undefined,
    });
    return NextResponse.json({ data: { post } });
  } catch (error) {
    if (error instanceof CommunityError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "NOT_FOUND" ? 404 : 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: "Could not update this post." } },
      { status: 503 },
    );
  }
}

/** Delete only the authenticated author's own post. */
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
  if (!(await deleteCommunityPost(user.id, id))) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Post not found." } },
      { status: 404 },
    );
  }
  return new NextResponse(null, { status: 204 });
}
