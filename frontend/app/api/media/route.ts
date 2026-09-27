import { NextResponse } from "next/server";

import { getCurrentUser } from "../../lib/auth";
import { fetchSafeImage } from "../../lib/metadata-extractor";

export const runtime = "nodejs";
export const maxDuration = 10;

/** Proxy one authenticated, validated preview image. */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const imageUrl = new URL(request.url).searchParams.get("url");
  if (!imageUrl || imageUrl.length > 4096) {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Invalid preview URL." } },
      { status: 400 },
    );
  }

  try {
    const image = await fetchSafeImage(imageUrl);
    return new NextResponse(Buffer.from(image.bytes), {
      headers: {
        "Cache-Control": "private, max-age=86400",
        "Content-Type": image.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "PREVIEW_UNAVAILABLE", message: "Preview unavailable." } },
      { status: 404 },
    );
  }
}
