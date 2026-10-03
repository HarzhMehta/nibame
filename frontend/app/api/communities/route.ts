import { NextResponse } from "next/server";

import { getCurrentUser } from "../../lib/auth";
import {
  CommunityError,
  createCommunity,
  listCommunities,
} from "../../lib/community-service";

interface CreateCommunityBody {
  name?: unknown;
  description?: unknown;
  categoryId?: unknown;
}

/** List discoverable communities for an authenticated account. */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }
  return NextResponse.json({ data: { communities: await listCommunities(user) } });
}

/** Create a community only as the database-designated super admin. */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }
  const body = (await request.json().catch(() => null)) as CreateCommunityBody | null;
  try {
    const community = await createCommunity(user, {
      name: typeof body?.name === "string" ? body.name : "",
      description: typeof body?.description === "string" ? body.description : "",
      categoryId: typeof body?.categoryId === "string" ? body.categoryId : undefined,
    });
    return NextResponse.json({ data: { community } }, { status: 201 });
  } catch (error) {
    if (error instanceof CommunityError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "FORBIDDEN" ? 403 : 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "CREATE_FAILED", message: "Could not create this community." } },
      { status: 503 },
    );
  }
}
