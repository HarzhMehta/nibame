import { NextResponse } from "next/server";

import { getCurrentUser } from "../../lib/auth";
import { parseUrl } from "../../lib/url-categorizer";
import { createUserCategory, PreferenceError } from "../../lib/user-preferences";

interface CategoryRequestBody {
  name?: unknown;
  sampleLink?: unknown;
}

/** Create a persistent category for the authenticated user. */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as CategoryRequestBody | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const sampleLink = typeof body?.sampleLink === "string" ? body.sampleLink : "";
  const parsed = parseUrl(sampleLink);
  const nameLength = Array.from(name).length;

  if (nameLength < 2 || nameLength > 40) {
    return NextResponse.json(
      { error: { code: "INVALID_NAME", message: "Use a category name between 2 and 40 characters." } },
      { status: 400 },
    );
  }
  if (!parsed) {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Enter a valid HTTP(S) link or bare domain." } },
      { status: 400 },
    );
  }

  try {
    const created = await createUserCategory(user.id, name, parsed.ruleDomain);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof PreferenceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "CATEGORY_EXISTS" ? 409 : 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "SAVE_FAILED", message: "Could not save this category. Try again." } },
      { status: 503 },
    );
  }
}
