import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type { LinkContentType, LinkIntent, LinkMetadata } from "./link-types";

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 5_000;

export interface ExtractedLinkMetadata {
  type: LinkContentType;
  intent: LinkIntent;
  title: string;
  description?: string;
  imageUrl?: string;
  faviconUrl?: string;
  sourceName: string;
  metadata: LinkMetadata;
}

interface UniversalMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
  faviconUrl?: string;
  siteName?: string;
  schemaType?: string;
  author?: string;
  price?: number;
  currency?: string;
  brand?: string;
  duration?: string;
  oEmbedUrl?: string;
}

interface AdapterMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
  sourceName?: string;
  metadata?: Partial<LinkMetadata>;
}

function decodeHtml(value: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => entities[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function absoluteUrl(value: string | undefined, base: URL): string | undefined {
  if (!value) return undefined;
  try {
    const resolved = new URL(value, base);
    return resolved.protocol === "http:" || resolved.protocol === "https:"
      ? resolved.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const value = address.toLowerCase();
  return (
    value === "::1" ||
    value === "::" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb")
  );
}

async function assertSafeUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported URL protocol.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Unsupported URL port.");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Local network URLs are not allowed.");
  }
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Private network URLs are not allowed.");
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BYTES) throw new Error("Page is too large.");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Array<Uint8Array> = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("Page is too large.");
    }
    chunks.push(result.value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

async function readLimitedBytes(response: Response, maximumBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maximumBytes) throw new Error("Resource is too large.");
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Array<Uint8Array> = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new Error("Resource is too large.");
    }
    chunks.push(result.value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

async function fetchHtml(url: URL, redirects = 0): Promise<{ html: string; url: URL }> {
  await assertSafeUrl(url);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "nibame-metadata/1.0",
    },
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location || redirects >= 3) throw new Error("Too many redirects.");
    return fetchHtml(new URL(location, url), redirects + 1);
  }
  if (!response.ok) {
    throw new Error("Metadata request failed with " + response.status + ".");
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("URL did not return HTML.");
  }
  return { html: await readLimitedText(response), url };
}

function findStructuredRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = findStructuredRecord(entry);
      if (result) return result;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record["@type"] === "string") return record;
  return findStructuredRecord(record["@graph"]);
}

function getString(record: Record<string, unknown> | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNestedString(
  record: Record<string, unknown> | null,
  parent: string,
  child: string,
): string | undefined {
  const value = record?.[parent];
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return getString(value as Record<string, unknown>, child);
}

function extractUniversal(html: string, pageUrl: URL): UniversalMetadata {
  const meta: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.property ?? attributes.name)?.toLowerCase();
    if (key && attributes.content && !meta[key]) meta[key] = attributes.content;
  }

  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  let faviconUrl: string | undefined;
  let oEmbedUrl: string | undefined;
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const rel = (attributes.rel ?? "").toLowerCase();
    const type = (attributes.type ?? "").toLowerCase();
    if (!faviconUrl && rel.includes("icon")) {
      faviconUrl = absoluteUrl(attributes.href, pageUrl);
    }
    if (!oEmbedUrl && rel === "alternate" && type.includes("json+oembed")) {
      oEmbedUrl = absoluteUrl(attributes.href, pageUrl);
    }
  }

  let structured: Record<string, unknown> | null = null;
  const scriptPattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    try {
      structured = findStructuredRecord(JSON.parse(match[1]) as unknown);
      if (structured) break;
    } catch {
      continue;
    }
  }

  const offersValue = structured?.offers;
  const offers =
    offersValue && typeof offersValue === "object" && !Array.isArray(offersValue)
      ? offersValue as Record<string, unknown>
      : null;
  const priceValue = getString(offers, "price") ?? getString(structured, "price");
  const imageValue = structured?.image;
  const schemaImage =
    typeof imageValue === "string"
      ? imageValue
      : Array.isArray(imageValue) && typeof imageValue[0] === "string"
        ? imageValue[0]
        : undefined;

  return {
    title:
      meta["og:title"] ??
      meta["twitter:title"] ??
      getString(structured, "name") ??
      (titleMatch ? decodeHtml(titleMatch[1]) : undefined),
    description:
      meta["og:description"] ??
      meta["twitter:description"] ??
      meta.description ??
      getString(structured, "description"),
    imageUrl: absoluteUrl(meta["og:image"] ?? meta["twitter:image"] ?? schemaImage, pageUrl),
    faviconUrl: faviconUrl ?? new URL("/favicon.ico", pageUrl).toString(),
    siteName: meta["og:site_name"],
    schemaType: getString(structured, "@type"),
    author: getNestedString(structured, "author", "name") ?? getString(structured, "author"),
    price: priceValue && Number.isFinite(Number(priceValue)) ? Number(priceValue) : undefined,
    currency: getString(offers, "priceCurrency") ?? getString(structured, "priceCurrency"),
    brand: getNestedString(structured, "brand", "name") ?? getString(structured, "brand"),
    duration: getString(structured, "duration"),
    oEmbedUrl,
  };
}

function plainText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function durationSeconds(value: string | undefined): number | undefined {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return undefined;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

/** Infer content type and intent from URL shape and structured metadata. */
export function classifyUrlShape(
  url: URL,
  schemaType?: string,
): { type: LinkContentType; intent: LinkIntent } {
  const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
  const schema = schemaType?.toLowerCase() ?? "";
  let type: LinkContentType = "webpage";

  if (
    (hostname === "github.com" || hostname === "gitlab.com" || hostname === "bitbucket.org") &&
    url.pathname.split("/").filter(Boolean).length >= 2
  ) {
    type = "repository";
  } else if (
    hostname === "spotify.com" ||
    hostname === "open.spotify.com" ||
    hostname === "soundcloud.com" ||
    hostname === "music.apple.com" ||
    hostname === "podcasts.apple.com" ||
    schema.includes("audio")
  ) {
    type = "audio";
  } else if (
    hostname === "youtube.com" ||
    hostname === "youtu.be" ||
    hostname === "vimeo.com" ||
    schema.includes("video")
  ) {
    type = "video";
  } else if (
    hostname.includes("maps.google.") ||
    hostname === "maps.apple.com" ||
    hostname === "openstreetmap.org" ||
    hostname === "waze.com" ||
    hostname === "here.com" ||
    hostname === "mapquest.com" ||
    hostname === "maps.me" ||
    hostname === "alltrails.com" ||
    hostname === "komoot.com" ||
    schema.includes("place")
  ) {
    type = "place";
  } else if (
    hostname === "eventbrite.com" ||
    hostname === "meetup.com" ||
    hostname === "ticketmaster.com" ||
    hostname === "bookmyshow.com" ||
    schema.includes("event")
  ) {
    type = "event";
  } else if (
    /\/(?:jobs|job|careers|positions)(?:\/|$)/i.test(url.pathname) ||
    hostname === "indeed.com" ||
    hostname === "greenhouse.io" ||
    hostname === "lever.co" ||
    schema.includes("jobposting")
  ) {
    type = "job";
  } else if (schema.includes("recipe")) {
    type = "recipe";
  } else if (schema.includes("product") || /\/(?:product|products|dp|item)\b/i.test(url.pathname)) {
    type = "product";
  } else if (
    hostname === "instagram.com" ||
    hostname === "x.com" ||
    hostname === "twitter.com" ||
    hostname === "tiktok.com" ||
    hostname === "reddit.com" ||
    hostname === "threads.net"
  ) {
    type = "social";
  } else if (
    /(?:docs\.|developer\.|documentation)/i.test(hostname) ||
    /\/(?:docs|documentation|reference|api)(?:\/|$)/i.test(url.pathname)
  ) {
    type = "documentation";
  } else if (
    schema.includes("article") ||
    /\/(?:blog|article|articles|post|posts|news)(?:\/|$)/i.test(url.pathname)
  ) {
    type = "article";
  }

  const intentByType: Record<LinkContentType, LinkIntent> = {
    article: "read",
    audio: "listen",
    video: "watch",
    social: "reference",
    repository: "try",
    product: "buy",
    place: "visit",
    event: "attend",
    job: "apply",
    recipe: "cook",
    documentation: "reference",
    webpage: "reference",
  };
  const packageRegistry = hostname === "npmjs.com" || hostname === "pypi.org";
  return { type, intent: packageRegistry ? "try" : intentByType[type] };
}

async function fetchJson(url: URL, redirects = 0): Promise<unknown> {
  await assertSafeUrl(url);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/json", "User-Agent": "nibame-metadata/1.0" },
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location || redirects >= 3) return null;
    return fetchJson(new URL(location, url), redirects + 1);
  }
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("json")) return null;
  const text = await readLimitedText(response);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function oEmbedAdapter(
  url: URL,
  endpoint: URL,
  sourceName?: string,
): Promise<AdapterMetadata> {
  if (!endpoint.searchParams.has("url")) endpoint.searchParams.set("url", url.toString());
  const payload = await fetchJson(endpoint);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const record = payload as Record<string, unknown>;
  return {
    title: getString(record, "title"),
    imageUrl: getString(record, "thumbnail_url"),
    sourceName: sourceName ?? getString(record, "provider_name"),
    metadata: { channel: getString(record, "author_name") },
  };
}

async function githubAdapter(url: URL): Promise<AdapterMetadata> {
  if (url.hostname.replace(/^www\./, "") !== "github.com") return {};
  const [owner, repository] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repository) return {};
  const endpoint =
    "https://api.github.com/repos/" +
    encodeURIComponent(owner) +
    "/" +
    encodeURIComponent(repository);
  const payload = await fetchJson(new URL(endpoint));
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const record = payload as Record<string, unknown>;
  const ownerValue = record.owner;
  const ownerRecord =
    ownerValue && typeof ownerValue === "object" && !Array.isArray(ownerValue)
      ? ownerValue as Record<string, unknown>
      : null;
  return {
    title: owner + "/" + repository,
    description: getString(record, "description"),
    imageUrl: getString(ownerRecord, "avatar_url"),
    sourceName: "GitHub",
    metadata: {
      language: getString(record, "language"),
      stars: typeof record.stargazers_count === "number" ? record.stargazers_count : undefined,
    },
  };
}

async function youtubeAdapter(url: URL): Promise<AdapterMetadata> {
  const hostname = url.hostname.replace(/^www\./, "");
  if (hostname !== "youtube.com" && hostname !== "youtu.be") return {};
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("url", url.toString());
  endpoint.searchParams.set("format", "json");
  return oEmbedAdapter(url, endpoint, "YouTube");
}

async function gitlabAdapter(url: URL): Promise<AdapterMetadata> {
  if (url.hostname.replace(/^www\./, "") !== "gitlab.com") return {};
  const [owner, repository] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repository) return {};
  const project = encodeURIComponent(owner + "/" + repository);
  const payload = await fetchJson(new URL("https://gitlab.com/api/v4/projects/" + project));
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const record = payload as Record<string, unknown>;
  return {
    title: getString(record, "path_with_namespace") ?? owner + "/" + repository,
    description: getString(record, "description"),
    imageUrl: getString(record, "avatar_url"),
    sourceName: "GitLab",
    metadata: {
      stars: typeof record.star_count === "number" ? record.star_count : undefined,
    },
  };
}

async function packageAdapter(url: URL): Promise<AdapterMetadata> {
  const hostname = url.hostname.replace(/^www\./, "");
  if (hostname === "npmjs.com") {
    const marker = url.pathname.indexOf("/package/");
    if (marker < 0) return {};
    const packageName = decodeURIComponent(url.pathname.slice(marker + 9)).split("/").slice(0, 2).join("/");
    if (!packageName) return {};
    const payload = await fetchJson(
      new URL("https://registry.npmjs.org/" + packageName.replace("/", "%2F") + "/latest"),
    );
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
    const record = payload as Record<string, unknown>;
    return {
      title: packageName,
      description: getString(record, "description"),
      sourceName: "npm",
    };
  }
  if (hostname === "pypi.org") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "project" || !parts[1]) return {};
    const payload = await fetchJson(
      new URL("https://pypi.org/pypi/" + encodeURIComponent(parts[1]) + "/json"),
    );
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
    const infoValue = (payload as Record<string, unknown>).info;
    const info = infoValue && typeof infoValue === "object" && !Array.isArray(infoValue)
      ? infoValue as Record<string, unknown>
      : null;
    return {
      title: getString(info, "name") ?? parts[1],
      description: getString(info, "summary"),
      sourceName: "PyPI",
    };
  }
  return {};
}

async function wikipediaAdapter(url: URL): Promise<AdapterMetadata> {
  if (!url.hostname.endsWith("wikipedia.org")) return {};
  const match = url.pathname.match(/^\/wiki\/([^/]+)/);
  if (!match) return {};
  const endpoint = new URL(
    url.protocol + "//" + url.hostname + "/api/rest_v1/page/summary/" + encodeURIComponent(decodeURIComponent(match[1])),
  );
  const payload = await fetchJson(endpoint);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const record = payload as Record<string, unknown>;
  const thumbnailValue = record.thumbnail;
  const thumbnail = thumbnailValue && typeof thumbnailValue === "object" && !Array.isArray(thumbnailValue)
    ? thumbnailValue as Record<string, unknown>
    : null;
  return {
    title: getString(record, "title"),
    description: getString(record, "extract"),
    imageUrl: getString(thumbnail, "source"),
    sourceName: "Wikipedia",
  };
}

async function sourceAdapter(url: URL, type: LinkContentType): Promise<AdapterMetadata> {
  const hostname = url.hostname.replace(/^www\./, "");
  if (hostname === "github.com") return githubAdapter(url);
  if (hostname === "gitlab.com") return gitlabAdapter(url);
  if (hostname === "youtube.com" || hostname === "youtu.be") return youtubeAdapter(url);
  if (hostname === "vimeo.com") {
    return oEmbedAdapter(url, new URL("https://vimeo.com/api/oembed.json"), "Vimeo");
  }
  if (hostname === "spotify.com" || hostname === "open.spotify.com") {
    return oEmbedAdapter(url, new URL("https://open.spotify.com/oembed"), "Spotify");
  }
  if (hostname === "soundcloud.com") {
    const endpoint = new URL("https://soundcloud.com/oembed");
    endpoint.searchParams.set("format", "json");
    return oEmbedAdapter(url, endpoint, "SoundCloud");
  }
  if (hostname === "tiktok.com") {
    return oEmbedAdapter(url, new URL("https://www.tiktok.com/oembed"), "TikTok");
  }
  if (hostname === "x.com" || hostname === "twitter.com") {
    return oEmbedAdapter(url, new URL("https://publish.twitter.com/oembed"), "X");
  }
  if (hostname === "reddit.com") {
    return oEmbedAdapter(url, new URL("https://www.reddit.com/oembed"), "Reddit");
  }
  if (hostname === "figma.com") {
    return oEmbedAdapter(url, new URL("https://www.figma.com/api/oembed"), "Figma");
  }
  if (hostname === "codepen.io") {
    const endpoint = new URL("https://codepen.io/api/oembed");
    endpoint.searchParams.set("format", "json");
    return oEmbedAdapter(url, endpoint, "CodePen");
  }
  if (hostname === "loom.com") {
    return oEmbedAdapter(url, new URL("https://www.loom.com/v1/oembed"), "Loom");
  }
  if (hostname === "dailymotion.com") {
    return oEmbedAdapter(url, new URL("https://www.dailymotion.com/services/oembed"), "Dailymotion");
  }
  if (hostname === "npmjs.com" || hostname === "pypi.org") return packageAdapter(url);
  if (hostname.endsWith("wikipedia.org")) return wikipediaAdapter(url);
  if (type === "place") return placeAdapter(url);
  return {};
}

function placeAdapter(url: URL): AdapterMetadata {
  const hostname = url.hostname.replace(/^www\./, "");
  if (hostname === "maps.apple.com") {
    return {
      title: url.searchParams.get("q") ?? url.searchParams.get("address") ?? undefined,
      sourceName: "Apple Maps",
      metadata: { address: url.searchParams.get("address") ?? undefined },
    };
  }
  if (!hostname.includes("google.") || !url.pathname.startsWith("/maps")) return {};
  const match = decodeURIComponent(url.pathname).match(/\/place\/([^/]+)/i);
  return {
    title: match?.[1]?.replace(/\+/g, " ") ?? url.searchParams.get("q") ?? undefined,
    sourceName: "Google Maps",
  };
}

/** Fetch and normalize deterministic metadata for a public URL. */
export async function extractLinkMetadata(input: string): Promise<ExtractedLinkMetadata> {
  const inputUrl = new URL(input);
  let finalUrl = inputUrl;
  let html = "";
  let universal: UniversalMetadata = {};
  let classification = classifyUrlShape(inputUrl);
  let adapter: AdapterMetadata = {};
  try {
    adapter = await sourceAdapter(inputUrl, classification.type);
  } catch {
    adapter = {};
  }

  try {
    const page = await fetchHtml(inputUrl);
    finalUrl = page.url;
    html = page.html;
    universal = extractUniversal(html, finalUrl);
    classification = classifyUrlShape(finalUrl, universal.schemaType);
    if (!adapter.title && universal.oEmbedUrl) {
      adapter = await oEmbedAdapter(finalUrl, new URL(universal.oEmbedUrl));
    }
  } catch (error) {
    if (!adapter.title) throw error;
  }

  const words = html ? plainText(html).split(/\s+/).filter(Boolean).length : 0;
  const metadata: LinkMetadata = {
    kind: classification.type,
    author: universal.author,
    durationSeconds: durationSeconds(universal.duration),
    readingMinutes:
      classification.type === "article" && words ? Math.max(1, Math.ceil(words / 225)) : undefined,
    price: universal.price,
    currency: universal.currency,
    brand: universal.brand,
    ...adapter.metadata,
  };

  return {
    type: classification.type,
    intent: classification.intent,
    title: adapter.title ?? universal.title ?? finalUrl.hostname,
    description: adapter.description ?? universal.description,
    imageUrl: adapter.imageUrl ?? universal.imageUrl,
    faviconUrl: universal.faviconUrl,
    sourceName:
      adapter.sourceName ?? universal.siteName ?? finalUrl.hostname.replace(/^www\./, ""),
    metadata,
  };
}

/** Fetch a public preview image without exposing the browser to third-party tracking. */
export async function fetchSafeImage(
  input: string,
  redirects = 0,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const url = new URL(input);
  await assertSafeUrl(url);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "image/*", "User-Agent": "nibame-media/1.0" },
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location || redirects >= 3) throw new Error("Too many redirects.");
    return fetchSafeImage(new URL(location, url).toString(), redirects + 1);
  }
  if (!response.ok) throw new Error("Image request failed.");
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("image/") || contentType.includes("svg")) {
    throw new Error("Unsupported preview image.");
  }
  return {
    bytes: await readLimitedBytes(response, 5_000_000),
    contentType,
  };
}
