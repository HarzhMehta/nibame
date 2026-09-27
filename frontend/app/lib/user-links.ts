import "server-only";

import { type ClientSession, ObjectId } from "mongodb";

import {
  classifyUrlShape,
  extractLinkMetadata,
} from "./metadata-extractor";
import type {
  LinkContentType,
  LinkIntent,
  LinkMetadata,
  LinkState,
  MetadataStatus,
  SavedLink,
} from "./link-types";
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
  type?: LinkContentType;
  intent?: LinkIntent;
  state?: LinkState;
  title?: string;
  description?: string;
  imageUrl?: string;
  faviconUrl?: string;
  sourceName?: string;
  metadataStatus?: MetadataStatus;
  metadata?: LinkMetadata;
  openedCount?: number;
  lastOpenedAt?: Date;
  resurfaceAfter?: Date;
  metadataUpdatedAt?: Date;
  metadataStartedAt?: Date;
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

export type LinkActivityAction = "open" | "archive" | "later";

export class LinkError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_URL" | "NOT_FOUND",
  ) {
    super(message);
  }
}

function serializeLink(link: LinkDocument): SavedLink {
  const fallback = classifyUrlShape(new URL(link.normalizedUrl));
  const type = link.type ?? fallback.type;
  return {
    id: link._id.toHexString(),
    url: link.originalUrl,
    normalizedUrl: link.normalizedUrl,
    domain: link.domain,
    ruleDomain: link.ruleDomain,
    categoryId: link.categoryId,
    categoryLabel: link.categoryLabel,
    color: link.color,
    type,
    intent: link.intent ?? fallback.intent,
    state: link.state ?? "new",
    title: link.title ?? link.domain,
    description: link.description,
    imageUrl: link.imageUrl,
    faviconUrl: link.faviconUrl,
    sourceName: link.sourceName ?? link.domain,
    metadataStatus: link.metadataStatus ?? "pending",
    metadata: link.metadata ?? { kind: type },
    openedCount: link.openedCount ?? 0,
    lastOpenedAt: link.lastOpenedAt?.toISOString(),
    resurfaceAfter: link.resurfaceAfter?.toISOString(),
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
  const shape = classifyUrlShape(new URL(parsed.normalizedUrl));
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
        type: shape.type,
        intent: shape.intent,
        state: "new",
        title: parsed.hostname,
        sourceName: parsed.hostname,
        metadataStatus: "pending",
        metadata: { kind: shape.type },
        openedCount: 0,
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

/** Enrich a saved link without blocking its original capture request. */
export async function enrichUserLink(userId: ObjectId, id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const database = await getDatabase();
  const objectId = new ObjectId(id);
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
  const claim = await database.collection<LinkDocument>("links").updateOne(
    {
      _id: objectId,
      userId,
      $or: [
        { metadataStatus: "pending" },
        { metadataStatus: { $exists: false } },
        { metadataStatus: "processing", metadataStartedAt: { $lt: staleBefore } },
      ],
    },
    { $set: { metadataStatus: "processing", metadataStartedAt: new Date() } },
  );
  if (claim.modifiedCount !== 1) return;
  const link = await database
    .collection<LinkDocument>("links")
    .findOne({ _id: objectId, userId });
  if (!link) return;

  try {
    const enriched = await extractLinkMetadata(link.normalizedUrl);
    await database.collection<LinkDocument>("links").updateOne(
      { _id: objectId, userId },
      {
        $set: {
          type: enriched.type,
          intent: enriched.intent,
          title: enriched.title,
          description: enriched.description,
          imageUrl: enriched.imageUrl,
          faviconUrl: enriched.faviconUrl,
          sourceName: enriched.sourceName,
          metadata: enriched.metadata,
          metadataStatus: "ready",
          metadataUpdatedAt: new Date(),
        },
        $unset: { metadataStartedAt: "" },
      },
    );
  } catch {
    await database.collection<LinkDocument>("links").updateOne(
      { _id: objectId, userId },
      {
        $set: {
          metadataStatus: "failed",
          metadataUpdatedAt: new Date(),
        },
        $unset: { metadataStartedAt: "" },
      },
    );
  }
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

/** Record a deterministic user action and return the updated link. */
export async function updateLinkActivity(
  userId: ObjectId,
  id: string,
  action: LinkActivityAction,
): Promise<SavedLink> {
  if (!ObjectId.isValid(id)) throw new LinkError("Link not found.", "NOT_FOUND");
  const database = await getDatabase();
  const objectId = new ObjectId(id);
  const now = new Date();

  if (action === "open") {
    await database.collection<LinkDocument>("links").updateOne(
      { _id: objectId, userId },
      {
        $inc: { openedCount: 1 },
        $set: { state: "active", lastOpenedAt: now, updatedAt: now },
      },
    );
  } else if (action === "archive") {
    await database.collection<LinkDocument>("links").updateOne(
      { _id: objectId, userId },
      { $set: { state: "archived", updatedAt: now } },
    );
  } else {
    const resurfaceAfter = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await database.collection<LinkDocument>("links").updateOne(
      { _id: objectId, userId },
      { $set: { state: "active", resurfaceAfter, updatedAt: now } },
    );
  }

  const link = await database.collection<LinkDocument>("links").findOne({ _id: objectId, userId });
  if (!link) throw new LinkError("Link not found.", "NOT_FOUND");
  return serializeLink(link);
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
