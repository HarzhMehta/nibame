import "server-only";

import { type ClientSession, ObjectId } from "mongodb";

import type { SavedLink } from "./link-types";
import { getDatabase } from "./mongodb";
import {
  categorizeUrl,
  getBuiltInCategories,
  parseUrl,
  type CategorySummary,
} from "./url-categorizer";

interface LinkDocument {
  _id: ObjectId;
  userId: ObjectId;
  originalUrl: string;
  normalizedUrl: string;
  domain: string;
  ruleDomain: string;
  categoryId: string;
  categoryLabel: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredDomainRule {
  userId: ObjectId;
  domain: string;
  categoryId: string;
}

interface StoredCustomCategory extends CategorySummary {
  userId: ObjectId;
}

export class LinkError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_URL" | "NOT_FOUND",
  ) {
    super(message);
  }
}

function serializeLink(link: LinkDocument): SavedLink {
  return {
    id: link._id.toHexString(),
    url: link.originalUrl,
    normalizedUrl: link.normalizedUrl,
    domain: link.domain,
    ruleDomain: link.ruleDomain,
    categoryId: link.categoryId,
    categoryLabel: link.categoryLabel,
    color: link.color,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  };
}

async function resolveCategory(
  userId: ObjectId,
  input: string,
): Promise<{ parsed: NonNullable<ReturnType<typeof parseUrl>>; category: CategorySummary }> {
  const parsed = parseUrl(input);
  if (!parsed) throw new LinkError("Enter a valid HTTP(S) URL or bare domain.", "INVALID_URL");

  const database = await getDatabase();
  const userRule = await database
    .collection<StoredDomainRule>("domain_rules")
    .findOne({ userId, domain: parsed.ruleDomain });
  if (userRule) {
    const builtInCategory = getBuiltInCategories().find(
      (category) => category.id === userRule.categoryId,
    );
    if (builtInCategory) return { parsed, category: builtInCategory };

    const customCategory = await database
      .collection<StoredCustomCategory>("custom_categories")
      .findOne({ userId, id: userRule.categoryId });
    if (customCategory) return { parsed, category: customCategory };
  }

  const result = categorizeUrl(input);
  return {
    parsed,
    category: {
      id: result.category,
      label: result.category_label,
      color: result.color,
    },
  };
}

/** Save or refresh one categorized link without creating duplicates. */
export async function saveUserLink(userId: ObjectId, input: string): Promise<SavedLink> {
  const { parsed, category } = await resolveCategory(userId, input);
  const database = await getDatabase();
  const now = new Date();
  await database.collection<LinkDocument>("links").updateOne(
    { userId, normalizedUrl: parsed.normalizedUrl },
    {
      $set: {
        originalUrl: input.trim(),
        domain: parsed.hostname,
        ruleDomain: parsed.ruleDomain,
        categoryId: category.id,
        categoryLabel: category.label,
        color: category.color,
        updatedAt: now,
      },
      $setOnInsert: {
        userId,
        normalizedUrl: parsed.normalizedUrl,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const link = await database
    .collection<LinkDocument>("links")
    .findOne({ userId, normalizedUrl: parsed.normalizedUrl });
  if (!link) throw new LinkError("Could not save this link.", "NOT_FOUND");
  return serializeLink(link);
}

/** Load the user's most recently saved links. */
export async function getUserLinks(userId: ObjectId): Promise<Array<SavedLink>> {
  const database = await getDatabase();
  const links = await database
    .collection<LinkDocument>("links")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .limit(500)
    .toArray();
  return links.map(serializeLink);
}

/** Delete one link only when it belongs to the current user. */
export async function deleteUserLink(userId: ObjectId, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const database = await getDatabase();
  const result = await database
    .collection<LinkDocument>("links")
    .deleteOne({ _id: new ObjectId(id), userId });
  return result.deletedCount === 1;
}

/** Keep saved links aligned when the user changes a domain rule. */
export async function updateLinksForDomain(
  userId: ObjectId,
  domain: string,
  category: CategorySummary,
  session?: ClientSession,
): Promise<void> {
  const database = await getDatabase();
  await database.collection<LinkDocument>("links").updateMany(
    { userId, ruleDomain: domain },
    {
      $set: {
        categoryId: category.id,
        categoryLabel: category.label,
        color: category.color,
        updatedAt: new Date(),
      },
    },
    { session },
  );
}
