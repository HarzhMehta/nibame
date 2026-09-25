import { NextResponse } from "next/server";

import { getCurrentUser } from "../../lib/auth";
import { parseUrl } from "../../lib/url-categorizer";
import { PreferenceError, setUserDomainRule } from "../../lib/user-preferences";

interface RuleRequestBody {
  categoryId?: unknown;
  sampleLink?: unknown;
}

/** Create or replace one persistent domain assignment for the authenticated user. */
export async function PUT(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as RuleRequestBody | null;
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  const sampleLink = typeof body?.sampleLink === "string" ? body.sampleLink : "";
  const parsed = parseUrl(sampleLink);

  if (!parsed) {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Enter a valid HTTP(S) link or bare domain." } },
      { status: 400 },
    );
  }
  if (!categoryId) {
    return NextResponse.json(
      { error: { code: "INVALID_CATEGORY", message: "Choose a category." } },
      { status: 400 },
    );
  }

  try {
    const rule = await setUserDomainRule(user.id, parsed.ruleDomain, categoryId);
    return NextResponse.json({ data: rule });
  } catch (error) {
    if (error instanceof PreferenceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "SAVE_FAILED", message: "Could not save this assignment. Try again." } },
      { status: 503 },
    );
  }
}
