import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

import { lookup } from "node:dns/promises";

import { fetchMetadata, MAX_RESPONSE_BYTES } from "./metadata";

const OG_HTML = `
<html><head>
<meta property="og:title" content="Example Title" />
<meta property="og:description" content="Example description." />
<meta property="og:image" content="/img/cover.png" />
<meta property="og:site_name" content="Example Site" />
<title>Fallback title</title>
</head><body></body></html>
`;

const FALLBACK_HTML = `
<html><head>
<title>Plain Title</title>
<meta name="description" content="Plain meta description." />
</head><body>
<p>This paragraph is long enough to be used as a fallback description for the page.</p>
</body></html>
`;

const PARAGRAPH_ONLY_HTML = `
<html><head><title>Paragraph Title</title></head><body>
<p>short</p>
<p>This paragraph is long enough to be used as a fallback description for the page.</p>
</body></html>
`;

const EMPTY_HTML = "<html><head></head><body></body></html>";

const MALFORMED_HTML = "<html><head><title>Broken<body><p>unterminated tags everywhere";

const PUBLIC_ADDRESS = [{ address: "93.184.216.34", family: 4 }];

function resolvesTo(address: string): void {
  vi.mocked(lookup).mockResolvedValue([{ address, family: address.includes(":") ? 6 : 4 }] as never);
}

function htmlResponse(
  body: string,
  options: { status?: number; contentType?: string | null } = {},
): Response {
  const headers = new Headers();
  const contentType = options.contentType === undefined ? "text/html" : options.contentType;
  if (contentType) headers.set("content-type", contentType);
  return new Response(body, { status: options.status ?? 200, headers });
}

function redirectResponse(location: string | null, status = 302): Response {
  const headers = new Headers();
  if (location) headers.set("location", location);
  return new Response(null, { status, headers });
}

function mockRoutes(routes: Record<string, () => Response | Promise<Response>>) {
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = String(input);
    const handler = routes[url];
    if (!handler) throw new Error(`Unexpected fetch for ${url}`);
    return handler();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.mocked(lookup).mockResolvedValue(PUBLIC_ADDRESS as never);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("fetch was not mocked for this test");
    }),
  );
});

describe("fetchMetadata", () => {
  it("short-circuits an invalid URL without fetching", async () => {
    const fetchMock = mockRoutes({});
    const result = await fetchMetadata("not a url");

    expect(result.isValid).toBe(false);
    expect(result.failureReason).toBe("invalid_url");
    expect(result.fetchOk).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefers Open Graph tags when present", async () => {
    mockRoutes({ "https://example.com/": () => htmlResponse(OG_HTML) });
    const result = await fetchMetadata("https://example.com/");

    expect(result.fetchOk).toBe(true);
    expect(result.title).toBe("Example Title");
    expect(result.titleSource).toBe("og");
    expect(result.description).toBe("Example description.");
    expect(result.descriptionSource).toBe("og");
    expect(result.image).toBe("https://example.com/img/cover.png");
    expect(result.imageSource).toBe("og");
    expect(result.siteName).toBe("Example Site");
    expect(result.siteNameSource).toBe("og");
  });

  it("falls back to <title> and <meta name=description>", async () => {
    mockRoutes({ "https://example.com/": () => htmlResponse(FALLBACK_HTML) });
    const result = await fetchMetadata("https://example.com/");

    expect(result.fetchOk).toBe(true);
    expect(result.title).toBe("Plain Title");
    expect(result.titleSource).toBe("html_fallback");
    expect(result.description).toBe("Plain meta description.");
    expect(result.descriptionSource).toBe("html_fallback");
    expect(result.image).toBeNull();
    expect(result.imageSource).toBe("missing");
  });

  it("falls back to the first sufficiently long paragraph", async () => {
    mockRoutes({ "https://example.com/": () => htmlResponse(PARAGRAPH_ONLY_HTML) });
    const result = await fetchMetadata("https://example.com/");

    expect(result.description).toBe(
      "This paragraph is long enough to be used as a fallback description for the page.",
    );
    expect(result.descriptionSource).toBe("html_fallback");
  });

  it("reports every field as missing when nothing is present", async () => {
    mockRoutes({ "https://example.com/": () => htmlResponse(EMPTY_HTML) });
    const result = await fetchMetadata("https://example.com/");

    expect(result.fetchOk).toBe(true);
    expect(result.title).toBeNull();
    expect(result.titleSource).toBe("missing");
    expect(result.description).toBeNull();
    expect(result.descriptionSource).toBe("missing");
    expect(result.image).toBeNull();
    expect(result.imageSource).toBe("missing");
    expect(result.siteName).toBeNull();
    expect(result.siteNameSource).toBe("missing");
  });

  it("does not throw on malformed HTML", async () => {
    mockRoutes({ "https://example.com/": () => htmlResponse(MALFORMED_HTML) });
    const result = await fetchMetadata("https://example.com/");

    expect(result.fetchOk).toBe(true);
  });

  it("aborts a response larger than the byte cap", async () => {
    const oversized = `<html><body><p>${"a".repeat(MAX_RESPONSE_BYTES + 1024)}</p></body></html>`;
    mockRoutes({ "https://example.com/": () => htmlResponse(oversized) });
    const result = await fetchMetadata("https://example.com/");

    expect(result.fetchOk).toBe(false);
    expect(result.failureReason).toBe("response_too_large");
  });

  it("reports a timeout", async () => {
    mockRoutes({
      "https://example.com/": () => {
        throw new DOMException("timed out", "TimeoutError");
      },
    });
    const result = await fetchMetadata("https://example.com/");

    expect(result.fetchOk).toBe(false);
    expect(result.failureReason).toBe("timeout");
  });

  it("reports a network failure as an http error", async () => {
    mockRoutes({
      "https://example.com/": () => {
        throw new TypeError("fetch failed");
      },
    });
    const result = await fetchMetadata("https://example.com/");

    expect(result.fetchOk).toBe(false);
    expect(result.failureReason).toBe("http_error");
  });

  it("rejects an unsupported content type", async () => {
    mockRoutes({
      "https://example.com/file.pdf": () =>
        htmlResponse("%PDF-1.4", { contentType: "application/pdf" }),
    });
    const result = await fetchMetadata("https://example.com/file.pdf");

    expect(result.fetchOk).toBe(false);
    expect(result.failureReason).toBe("unsupported_content_type");
  });

  it("reports a non-200 status", async () => {
    mockRoutes({
      "https://example.com/missing": () => htmlResponse("", { status: 404, contentType: null }),
    });
    const result = await fetchMetadata("https://example.com/missing");

    expect(result.fetchOk).toBe(false);
    expect(result.failureReason).toBe("http_error");
    expect(result.statusCode).toBe(404);
  });

  it("resolves a relative og:image against the page URL", async () => {
    mockRoutes({ "https://example.com/post": () => htmlResponse(OG_HTML) });
    const result = await fetchMetadata("https://example.com/post");

    expect(result.image).toBe("https://example.com/img/cover.png");
  });

  it("follows a redirect", async () => {
    mockRoutes({
      "https://example.com/old": () => redirectResponse("https://example.com/new"),
      "https://example.com/new": () => htmlResponse(OG_HTML),
    });
    const result = await fetchMetadata("https://example.com/old");

    expect(result.fetchOk).toBe(true);
    expect(result.title).toBe("Example Title");
  });

  it("follows a relative redirect", async () => {
    mockRoutes({
      "https://example.com/old": () => redirectResponse("/new"),
      "https://example.com/new": () => htmlResponse(OG_HTML),
    });
    const result = await fetchMetadata("https://example.com/old");

    expect(result.fetchOk).toBe(true);
    expect(result.title).toBe("Example Title");
  });

  it("stops after the redirect limit", async () => {
    mockRoutes({
      "https://example.com/a": () => redirectResponse("https://example.com/b"),
      "https://example.com/b": () => redirectResponse("https://example.com/c"),
      "https://example.com/c": () => redirectResponse("https://example.com/d"),
      "https://example.com/d": () => redirectResponse("https://example.com/e"),
    });
    const result = await fetchMetadata("https://example.com/a");

    expect(result.fetchOk).toBe(false);
    expect(result.failureReason).toBe("redirect_limit_exceeded");
  });

  it("treats a redirect without a location header as an http error", async () => {
    mockRoutes({ "https://example.com/old": () => redirectResponse(null) });
    const result = await fetchMetadata("https://example.com/old");

    expect(result.fetchOk).toBe(false);
    expect(result.failureReason).toBe("http_error");
    expect(result.statusCode).toBe(302);
  });
});

describe("SSRF guard", () => {
  it("blocks a host resolving to loopback", async () => {
    resolvesTo("127.0.0.1");
    const fetchMock = mockRoutes({});
    const result = await fetchMetadata("https://internal.example.com/");

    expect(result.isValid).toBe(false);
    expect(result.failureReason).toBe("blocked_host");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks a host resolving to the cloud metadata address", async () => {
    resolvesTo("169.254.169.254");
    const fetchMock = mockRoutes({});
    const result = await fetchMetadata("https://cloud-meta.example.com/");

    expect(result.isValid).toBe(false);
    expect(result.failureReason).toBe("blocked_host");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks a host resolving to a private range", async () => {
    resolvesTo("10.0.0.5");
    const result = await fetchMetadata("https://intranet.example.com/");

    expect(result.failureReason).toBe("blocked_host");
  });

  it("blocks an IPv6 loopback literal", async () => {
    const fetchMock = mockRoutes({});
    const result = await fetchMetadata("http://[::1]/");

    expect(result.failureReason).toBe("blocked_host");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks an IPv6 unique-local address", async () => {
    resolvesTo("fd00::1");
    const result = await fetchMetadata("https://internal6.example.com/");

    expect(result.failureReason).toBe("blocked_host");
  });

  it("blocks an IPv4-mapped IPv6 loopback", async () => {
    resolvesTo("::ffff:127.0.0.1");
    const result = await fetchMetadata("https://mapped.example.com/");

    expect(result.failureReason).toBe("blocked_host");
  });

  it("blocks a host that fails to resolve", async () => {
    vi.mocked(lookup).mockRejectedValue(new Error("ENOTFOUND") as never);
    const result = await fetchMetadata("https://nonexistent.example.com/");

    expect(result.failureReason).toBe("blocked_host");
  });

  it("re-checks the host after a redirect", async () => {
    mockRoutes({
      "https://example.com/redirect-to-internal": () =>
        redirectResponse("http://169.254.169.254/secret"),
    });
    const result = await fetchMetadata("https://example.com/redirect-to-internal");

    expect(result.isValid).toBe(false);
    expect(result.failureReason).toBe("blocked_host");
  });

  it("rejects a redirect to a non-HTTP scheme", async () => {
    mockRoutes({
      "https://example.com/old": () => redirectResponse("file:///etc/passwd"),
    });
    const result = await fetchMetadata("https://example.com/old");

    expect(result.isValid).toBe(false);
    expect(result.failureReason).toBe("blocked_host");
  });
});
