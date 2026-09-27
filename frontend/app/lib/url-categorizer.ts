import { parse } from "tldts";

import categoryRules from "./category-rules.json";

interface RawCategoryDefinition {
  label: string;
  description: string;
  color: string;
  domains: Array<string>;
}

export interface CategorySummary {
  id: string;
  label: string;
  color: string;
}

export interface CategoryDefinition extends CategorySummary {
  description: string;
  domains: Array<string>;
  domain_count: number;
  examples: Array<string>;
  isCustom?: false;
}

export interface CustomCategory extends CategorySummary {
  domains: Array<string>;
  domain_count: number;
  examples: Array<string>;
  isCustom: true;
}

export interface SessionDomainRule {
  domain: string;
  categoryId: string;
}

export interface ParsedUrl {
  inputUrl: string;
  normalizedUrl: string;
  hostname: string;
  ruleDomain: string;
  pathname: string;
}

export interface CategorizationResult {
  domain: string;
  category: string;
  category_label: string;
  color: string;
  matched_by: string;
  matched_rule: string | null;
  confidence: "none" | "low" | "medium" | "high";
  is_valid: boolean;
}

const DOMAIN_PATH_RULES = [
  { domain: "linkedin.com", pattern: /^\/jobs(?:\/|$)/, category: "jobs_careers" },
  { domain: "google.com", pattern: /^\/maps(?:\/|$)/, category: "travel_places" },
  { domain: "google.com", pattern: /^\/search(?:\/|$)/, category: "search_discovery" },
] as const;

const PATH_HINTS = [
  { pattern: /\/(?:jobs|careers|vacancies)(?:\/|$)/, category: "jobs_careers" },
  { pattern: /\/(?:maps|directions|places)(?:\/|$)/, category: "travel_places" },
  { pattern: /\/(?:watch|video|videos|reel|reels|shorts)(?:\/|$)/, category: "video_streaming" },
] as const;

const FILE_EXTENSION_CATEGORIES: Record<string, string> = {
  ".pdf": "cloud_documents",
  ".doc": "cloud_documents",
  ".docx": "cloud_documents",
  ".ppt": "cloud_documents",
  ".pptx": "cloud_documents",
  ".xls": "cloud_documents",
  ".xlsx": "cloud_documents",
  ".csv": "cloud_documents",
  ".epub": "entertainment_books",
  ".mobi": "entertainment_books",
  ".mp3": "music_audio",
  ".wav": "music_audio",
  ".m4a": "music_audio",
  ".mp4": "video_streaming",
  ".mov": "video_streaming",
  ".webm": "video_streaming",
  ".ipynb": "development_code",
};

const CUSTOM_CATEGORY_COLORS = [
  "#ff7c8f",
  "#7aa8ff",
  "#a995ff",
  "#55d6b0",
  "#f1bd64",
  "#e88cff",
] as const;

const categories = Object.entries(
  categoryRules as Record<string, RawCategoryDefinition>,
).map<CategoryDefinition>(([id, category]) => ({
  id,
  label: category.label,
  description: category.description,
  color: category.color,
  domains: category.domains,
  domain_count: category.domains.length,
  examples: category.domains.slice(0, 4),
}));

const categoriesById = new Map(categories.map((category) => [category.id, category]));
const domainIndex = categories
  .flatMap((category) => category.domains.map((domain) => ({ domain, category: category.id })))
  .sort((left, right) => right.domain.length - left.domain.length);

function stripPresentationPrefix(hostname: string): string {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (normalized.startsWith("www.")) return normalized.slice(4);
  if (normalized.startsWith("m.")) return normalized.slice(2);
  return normalized;
}

/** Parse an HTTP(S) URL or bare domain with a registrable parent domain. */
export function parseUrl(input: string): ParsedUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const hostname = stripPresentationPrefix(url.hostname);
  if (!hostname || /\s/.test(hostname)) return null;

  url.hostname = hostname;
  const parsedDomain = parse(hostname, { allowPrivateDomains: true });
  return {
    inputUrl: input,
    normalizedUrl: url.toString(),
    hostname,
    ruleDomain: parsedDomain.domain ?? hostname,
    pathname: url.pathname.toLowerCase() || "/",
  };
}

/** Check a hostname against an exact or parent-domain rule safely. */
export function matchesDomain(hostname: string, ruleDomain: string): boolean {
  const host = stripPresentationPrefix(hostname);
  const rule = stripPresentationPrefix(ruleDomain);
  return host === rule || host.endsWith(`.${rule}`);
}

/** Return the most specific session rule for a URL. */
export function findSessionRule(
  input: string,
  rules: Array<SessionDomainRule>,
): SessionDomainRule | null {
  const parsed = parseUrl(input);
  if (!parsed) return null;
  return (
    [...rules]
      .sort((left, right) => right.domain.length - left.domain.length)
      .find((rule) => matchesDomain(parsed.hostname, rule.domain)) ?? null
  );
}

function categoryResult(
  parsed: ParsedUrl,
  categoryId: string,
  matchedBy: string,
  matchedRule: string | null,
  confidence: CategorizationResult["confidence"],
): CategorizationResult {
  const category = categoriesById.get(categoryId) ?? categoriesById.get("unknown");
  if (!category) throw new Error("The unknown category rule is missing.");
  return {
    domain: parsed.hostname,
    category: category.id,
    category_label: category.label,
    color: category.color,
    matched_by: matchedBy,
    matched_rule: matchedRule,
    confidence,
    is_valid: true,
  };
}

/** Categorize a URL using the same deterministic priority previously used by Python. */
export function categorizeUrl(input: string): CategorizationResult {
  const parsed = parseUrl(input);
  if (!parsed) {
    const unknown = categoriesById.get("unknown");
    if (!unknown) throw new Error("The unknown category rule is missing.");
    return {
      domain: "",
      category: unknown.id,
      category_label: unknown.label,
      color: unknown.color,
      matched_by: "invalid",
      matched_rule: null,
      confidence: "none",
      is_valid: false,
    };
  }

  for (const rule of DOMAIN_PATH_RULES) {
    if (matchesDomain(parsed.hostname, rule.domain) && rule.pattern.test(parsed.pathname)) {
      return categoryResult(parsed, rule.category, "domain_path", rule.domain, "high");
    }
  }

  const domainRule = domainIndex.find((rule) => matchesDomain(parsed.hostname, rule.domain));
  if (domainRule) {
    return categoryResult(
      parsed,
      domainRule.category,
      "domain",
      domainRule.domain,
      domainRule.category === "link_shortener" ? "low" : "high",
    );
  }

  const extensionMatch = parsed.pathname.match(/\.[a-z0-9]+$/);
  const extension = extensionMatch?.[0] ?? "";
  if (FILE_EXTENSION_CATEGORIES[extension]) {
    return categoryResult(
      parsed,
      FILE_EXTENSION_CATEGORIES[extension],
      "file_extension",
      extension,
      "medium",
    );
  }

  for (const hint of PATH_HINTS) {
    if (hint.pattern.test(parsed.pathname)) {
      return categoryResult(parsed, hint.category, "path", hint.pattern.source, "medium");
    }
  }

  return categoryResult(parsed, "unknown", "fallback", null, "low");
}

/** Return the built-in categories shown in the application. */
export function getBuiltInCategories(): Array<CategoryDefinition> {
  return categories.filter((category) => category.id !== "unknown");
}

/** Check category names case-insensitively. */
export function categoryNameExists(
  name: string,
  availableCategories: Array<CategorySummary>,
): boolean {
  const normalizedName = name.trim().toLocaleLowerCase();
  return availableCategories.some(
    (category) => category.label.trim().toLocaleLowerCase() === normalizedName,
  );
}

/** Create a temporary custom category from one learned domain. */
export function createCustomCategory(
  name: string,
  ruleDomain: string,
  index: number,
): CustomCategory {
  const normalizedName = name.trim();
  const slug = normalizedName
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "category";
  return {
    id: `custom-${slug}-${index + 1}`,
    label: normalizedName,
    color: CUSTOM_CATEGORY_COLORS[index % CUSTOM_CATEGORY_COLORS.length],
    domains: [ruleDomain],
    domain_count: 1,
    examples: [ruleDomain],
    isCustom: true,
  };
}
