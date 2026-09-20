import { parse } from "tldts";

export interface CategorySummary {
  id: string;
  label: string;
  color: string;
}

export interface CustomCategory extends CategorySummary {
  domains: Array<string>;
  domain_count: number;
  examples: Array<string>;
  isCustom: true;
}

export interface CustomDomainRule {
  domain: string;
  categoryId: string;
}

export interface ParsedRuleDomain {
  normalizedUrl: string;
  hostname: string;
  ruleDomain: string;
}

export interface SessionCategoryState {
  categories: Array<CustomCategory>;
  rules: Array<CustomDomainRule>;
}

const CUSTOM_CATEGORY_COLORS = [
  "#ff7c8f",
  "#7aa8ff",
  "#a995ff",
  "#55d6b0",
  "#f1bd64",
  "#e88cff",
] as const;

/** Parse an HTTP(S) URL or bare domain into its registrable rule domain. */
export function parseRuleDomain(input: string): ParsedRuleDomain | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (!(["http:", "https:"] as const).includes(url.protocol as "http:" | "https:")) {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || /\s/.test(hostname)) return null;

  const parsed = parse(hostname, { allowPrivateDomains: true });
  return {
    normalizedUrl: url.toString(),
    hostname,
    ruleDomain: parsed.domain ?? hostname,
  };
}

/** Return true when a hostname belongs to a registrable session rule domain. */
export function matchesRuleDomain(hostname: string, ruleDomain: string): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/\.$/, "");
  const normalizedRule = ruleDomain.toLowerCase().replace(/\.$/, "");
  return normalizedHost === normalizedRule || normalizedHost.endsWith(`.${normalizedRule}`);
}

/** Find the most specific custom session rule matching an input URL. */
export function findCustomRule(
  input: string,
  rules: Array<CustomDomainRule>,
): CustomDomainRule | null {
  const parsed = parseRuleDomain(input);
  if (!parsed) return null;

  return (
    [...rules]
      .sort((left, right) => right.domain.length - left.domain.length)
      .find((rule) => matchesRuleDomain(parsed.hostname, rule.domain)) ?? null
  );
}

/** Check category labels case-insensitively after trimming whitespace. */
export function categoryNameExists(
  name: string,
  categories: Array<CategorySummary>,
): boolean {
  const normalizedName = name.trim().toLocaleLowerCase();
  return categories.some(
    (category) => category.label.trim().toLocaleLowerCase() === normalizedName,
  );
}

/** Create an in-memory custom category with a deterministic id and palette color. */
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

/** Produce fresh empty session state, which is also the state after refresh. */
export function createSessionCategoryState(): SessionCategoryState {
  return { categories: [], rules: [] };
}
