import { NextResponse } from "next/server";

import { getCurrentUser } from "../../lib/auth";
import { fetchMetadata } from "../../lib/metadata";

export const runtime = "nodejs";

interface MetadataRequestBody {
  url?: unknown;
}

/** Extract OG/HTML metadata for one URL on behalf of the authenticated user. */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as MetadataRequestBody | null;
  const url = typeof body?.url === "string" ? body.url.slice(0, 4096) : "";
  if (!url.trim()) {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Enter a valid HTTP(S) link or bare domain." } },
      { status: 400 },
    );
  }

  const metadata = await fetchMetadata(url);
  if (!metadata.isValid) {
    return NextResponse.json(
      {
        error: {
          code: metadata.failureReason === "blocked_host" ? "BLOCKED_HOST" : "INVALID_URL",
          message:
            metadata.failureReason === "blocked_host"
              ? "This link points to an address that cannot be fetched."
              : "Enter a valid HTTP(S) link or bare domain.",
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ data: metadata });
}
