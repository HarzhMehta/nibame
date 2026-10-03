import { after, NextResponse } from "next/server";

import { getCurrentUser } from "../../../../lib/auth";
import type { CommunityPostKind } from "../../../../lib/community-types";
import {
  CommunityError,
  createCommunityPost,
  enrichCommunityPost,
  listCommunityPosts,
} from "../../../../lib/community-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface CreatePostBody {
  kind?: unknown;
  text?: unknown;
  url?: unknown;
  categoryId?: unknown;
}

/** Return one finite page of posts for a joined member. */
export async function GET(
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
  try {
    const { id } = await context.params;
    const before = new URL(request.url).searchParams.get("before") ?? undefined;
    const page = await listCommunityPosts(user.id, id, before);
    for (const post of page.posts
      .filter((candidate) =>
        candidate.metadataStatus === "pending" || candidate.metadataStatus === "processing",
      )
      .slice(0, 4)) {
      after(() => enrichCommunityPost(post.id));
    }
    return NextResponse.json({ data: page });
  } catch (error) {
    if (error instanceof CommunityError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "NOT_JOINED" ? 403 : 404 },
      );
    }
    return NextResponse.json(
      { error: { code: "LOAD_FAILED", message: "Could not load community posts." } },
      { status: 503 },
    );
  }
}

/** Create a link or note as a joined member. */
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
  const body = (await request.json().catch(() => null)) as CreatePostBody | null;
  try {
    const { id } = await context.params;
    const post = await createCommunityPost(user.id, id, {
      kind: body?.kind as CommunityPostKind,
      text: typeof body?.text === "string" ? body.text : "",
      url: typeof body?.url === "string" ? body.url : undefined,
      categoryId: typeof body?.categoryId === "string" ? body.categoryId : undefined,
    });
    if (post.kind === "link") after(() => enrichCommunityPost(post.id));
    return NextResponse.json({ data: { post } }, { status: 201 });
  } catch (error) {
    if (error instanceof CommunityError) {
      const status =
        error.code === "NOT_JOINED"
          ? 403
          : error.code === "RATE_LIMITED"
            ? 429
            : error.code === "NOT_FOUND"
              ? 404
              : 400;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }
    return NextResponse.json(
      { error: { code: "POST_FAILED", message: "Could not add this post." } },
      { status: 503 },
    );
  }
}
