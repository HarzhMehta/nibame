import { NextResponse } from "next/server";

export const revalidate = 3600;

/** Return a cached public star count without exposing a GitHub token. */
export async function GET(): Promise<NextResponse> {
  try {
    const response = await fetch("https://api.github.com/repos/HarzhMehta/nibame", {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "nibame-app",
      },
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error("GitHub unavailable.");
    const payload = (await response.json()) as { stargazers_count?: unknown };
    return NextResponse.json({
      data: {
        stars: typeof payload.stargazers_count === "number" ? payload.stargazers_count : null,
      },
    });
  } catch {
    return NextResponse.json({ data: { stars: null } });
  }
}
