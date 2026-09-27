import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import * as cheerio from "cheerio";
import ipaddr from "ipaddr.js";

import { parseUrl } from "./url-categorizer";

export const USER_AGENT = "nibame-metadata-bot/0.1 (+https://github.com/ekansh-exe/nibame)";
export const REQUEST_TIMEOUT_MS = 5_000;
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
export const MAX_REDIRECTS = 3;

const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];
const MIN_FALLBACK_PARAGRAPH_CHARS = 60;
const REDIRECT_STATUS_CODES = [301, 302, 303, 307, 308];

export type FieldSource = "og" | "html_fallback" | "missing";

export type FailureReason =
  | "invalid_url"
  | "blocked_host"
  | "timeout"
  | "http_error"
  | "unsupported_content_type"
  | "response_too_large"
  | "parse_error"
  | "redirect_limit_exceeded";

export interface MetadataFields {
  title: string | null;
  titleSource: FieldSource;
  description: string | null;
  descriptionSource: FieldSource;
  image: string | null;
  imageSource: FieldSource;
  siteName: string | null;
  siteNameSource: FieldSource;
}

export interface MetadataResult extends MetadataFields {
  inputUrl: string;
  normalizedUrl: string;
  domain: string;
  isValid: boolean;
  fetchOk: boolean;
  failureReason: FailureReason | null;
  statusCode: number | null;
}

function emptyFields(): MetadataFields {
  return {
    title: null,
    titleSource: "missing",
    description: null,
    descriptionSource: "missing",
    image: null,
    imageSource: "missing",
    siteName: null,
    siteNameSource: "missing",
  };
}

/** Accept only globally routable unicast addresses, unwrapping IPv4-mapped IPv6. */
function isSafeAddress(rawAddress: string): boolean {
  let address: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    address = ipaddr.parse(rawAddress);
  } catch {
    return false;
  }

  if (address.kind() === "ipv6") {
    const ipv6 = address as ipaddr.IPv6;
    if (ipv6.isIPv4MappedAddress()) {
      return isSafeAddress(ipv6.toIPv4Address().toString());
    }
  }
  return address.range() === "unicast";
}

/** Reject hostnames that resolve to a private, loopback, link-local or reserved address. */
async function isSafeHost(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (isIP(host)) return isSafeAddress(host);

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    return false;
  }
  return addresses.length > 0 && addresses.every((entry) => isSafeAddress(entry.address));
}

/** Pure function: parse HTML and apply the OG/fallback extraction chain. */
export function extractMetadataFromHtml(html: string, pageUrl: string): MetadataFields {
  let page: cheerio.CheerioAPI;
  try {
    page = cheerio.load(html);
  } catch {
    return emptyFields();
  }

  const metaContent = (selector: string): string | null => {
    const content = page(selector).first().attr("content")?.trim();
    return content ? content : null;
  };

  let title = metaContent('meta[property="og:title"]');
  let titleSource: FieldSource = "og";
  if (title === null) {
    title = page("title").first().text().trim() || null;
    titleSource = title ? "html_fallback" : "missing";
  }

  let description = metaContent('meta[property="og:description"]');
  let descriptionSource: FieldSource = "og";
  if (description === null) {
    description = metaContent('meta[name="description"]');
    descriptionSource = description ? "html_fallback" : "missing";
  }
  if (description === null) {
    for (const paragraph of page("p").toArray()) {
      const text = page(paragraph).text().trim();
      if (text.length >= MIN_FALLBACK_PARAGRAPH_CHARS) {
        description = text;
        descriptionSource = "html_fallback";
        break;
      }
    }
  }

  let image = metaContent('meta[property="og:image"]');
  let imageSource: FieldSource = "missing";
  if (image) {
    try {
      image = new URL(image, pageUrl).toString();
      imageSource = "og";
    } catch {
      image = null;
    }
  }

  const siteName = metaContent('meta[property="og:site_name"]');

  return {
    title,
    titleSource,
    description,
    descriptionSource,
    image,
    imageSource,
    siteName,
    siteNameSource: siteName ? "og" : "missing",
  };
}

interface ResultOptions {
  isValid: boolean;
  fetchOk: boolean;
  failureReason: FailureReason | null;
  statusCode?: number | null;
  fields?: MetadataFields;
}

function buildResult(
  inputUrl: string,
  normalizedUrl: string,
  domain: string,
  options: ResultOptions,
): MetadataResult {
  return {
    inputUrl,
    normalizedUrl,
    domain,
    isValid: options.isValid,
    fetchOk: options.fetchOk,
    failureReason: options.failureReason,
    statusCode: options.statusCode ?? null,
    ...(options.fields ?? emptyFields()),
  };
}

function contentTypeAllowed(response: Response): boolean {
  const mediaType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  return ALLOWED_CONTENT_TYPES.includes(mediaType);
}

function decodeBody(bytes: Uint8Array, contentType: string | null): string {
  const charset = contentType?.match(/charset=["']?([^;"'\s]+)/i)?.[1];
  if (charset) {
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch {
      // An unknown charset label falls through to UTF-8.
    }
  }
  return new TextDecoder("utf-8").decode(bytes);
}

/** Read the response body, aborting once MAX_RESPONSE_BYTES is exceeded. */
async function readBoundedText(response: Response): Promise<string | null> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Array<Uint8Array> = [];
  let totalBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return decodeBody(body, response.headers.get("content-type"));
}

function failureFromError(error: unknown): FailureReason {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  if (name === "TimeoutError" || name === "AbortError") return "timeout";
  if (error instanceof TypeError) return "http_error";
  return "parse_error";
}

/** Validate, SSRF-check, fetch, and parse metadata for a single URL. */
export async function fetchMetadata(input: string): Promise<MetadataResult> {
  const parsed = parseUrl(input);
  if (!parsed) {
    return buildResult(input, "", "", {
      isValid: false,
      fetchOk: false,
      failureReason: "invalid_url",
    });
  }

  let currentUrl = parsed.normalizedUrl;
  let currentDomain = parsed.hostname;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!(await isSafeHost(new URL(currentUrl).hostname))) {
      return buildResult(input, parsed.normalizedUrl, parsed.hostname, {
        isValid: false,
        fetchOk: false,
        failureReason: "blocked_host",
      });
    }

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (REDIRECT_STATUS_CODES.includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          return buildResult(input, parsed.normalizedUrl, currentDomain, {
            isValid: true,
            fetchOk: false,
            failureReason: "http_error",
            statusCode: response.status,
          });
        }

        let target: string;
        try {
          target = new URL(location, currentUrl).toString();
        } catch {
          return buildResult(input, parsed.normalizedUrl, currentDomain, {
            isValid: false,
            fetchOk: false,
            failureReason: "blocked_host",
          });
        }

        const next = parseUrl(target);
        if (!next) {
          return buildResult(input, parsed.normalizedUrl, currentDomain, {
            isValid: false,
            fetchOk: false,
            failureReason: "blocked_host",
          });
        }
        currentUrl = next.normalizedUrl;
        currentDomain = next.hostname;
        continue;
      }

      if (response.status !== 200) {
        return buildResult(input, parsed.normalizedUrl, currentDomain, {
          isValid: true,
          fetchOk: false,
          failureReason: "http_error",
          statusCode: response.status,
        });
      }

      if (!contentTypeAllowed(response)) {
        return buildResult(input, parsed.normalizedUrl, currentDomain, {
          isValid: true,
          fetchOk: false,
          failureReason: "unsupported_content_type",
          statusCode: response.status,
        });
      }

      const text = await readBoundedText(response);
      if (text === null) {
        return buildResult(input, parsed.normalizedUrl, currentDomain, {
          isValid: true,
          fetchOk: false,
          failureReason: "response_too_large",
          statusCode: response.status,
        });
      }

      return buildResult(input, parsed.normalizedUrl, currentDomain, {
        isValid: true,
        fetchOk: true,
        failureReason: null,
        statusCode: response.status,
        fields: extractMetadataFromHtml(text, currentUrl),
      });
    } catch (error) {
      return buildResult(input, parsed.normalizedUrl, currentDomain, {
        isValid: true,
        fetchOk: false,
        failureReason: failureFromError(error),
      });
    }
  }

  return buildResult(input, parsed.normalizedUrl, currentDomain, {
    isValid: true,
    fetchOk: false,
    failureReason: "redirect_limit_exceeded",
  });
}
