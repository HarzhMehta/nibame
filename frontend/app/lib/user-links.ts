import "server-only";

import { type ClientSession, ObjectId } from "mongodb";

import {
  classifyUrlShape,
  extractLinkMetadata,
} from "./metadata-extractor";
import { blindIndex, decryptJson, encryptJson } from "./data-encryption";
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
  originalUrl?: string;
  normalizedUrl?: string;
  domain?: string;
  ruleDomain?: string;
  urlLookup?: string;
  ruleLookup?: string;
  categoryId: string;
  categoryLabel?: string;
  color: string;
  type?: LinkContentType;
  intent?: LinkIntent;
  state?: LinkState;
  title?: string;
  description?: string;
  imageUrl?: string;
  faviconUrl?: string;
  sourceName?: string;
  userDescription?: string;
  importedFromCommunityPostIds?: Array<string>;
  metadataStatus?: MetadataStatus;
  metadata?: LinkMetadata;
  openedCount?: number;
  lastOpenedAt?: Date;
  resurfaceAfter?: Date;
  metadataUpdatedAt?: Date;
  metadataStartedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  privateData?: string;
}

interface LinkPrivateData {
  originalUrl: string;
  normalizedUrl: string;
  domain: string;
  ruleDomain: string;
  categoryLabel: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  faviconUrl?: string;
  sourceName?: string;
  userDescription?: string;
  metadata?: LinkMetadata;
}

interface StoredDomainRule {
  userId: ObjectId;
  domain?: string;
  domainLookup?: string;
  categoryId: string;
  privateData?: string;
}

interface StoredCustomCategory {
  _id: ObjectId;
  userId: ObjectId;
  id: string;
  label?: string;
  color: string;
  privateData?: string;
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

function privateLinkData(link: LinkDocument): LinkPrivateData {
  if (link.privateData) {
    return decryptJson<LinkPrivateData>(link.privateData, "link.privateData");
  }
  return {
    originalUrl: link.originalUrl ?? "",
    normalizedUrl: link.normalizedUrl ?? "",
    domain: link.domain ?? "",
    ruleDomain: link.ruleDomain ?? "",
    categoryLabel: link.categoryLabel ?? "Uncategorized",
    title: link.title,
    description: link.description,
    imageUrl: link.imageUrl,
    faviconUrl: link.faviconUrl,
    sourceName: link.sourceName,
    userDescription: link.userDescription,
    metadata: link.metadata,
  };
}

function serializeLink(link: LinkDocument): SavedLink {
  const privateData = privateLinkData(link);
  const fallback = classifyUrlShape(new URL(privateData.normalizedUrl));
  const type = link.type ?? fallback.type;
  return {
    id: link._id.toHexString(),
    url: privateData.originalUrl,
    normalizedUrl: privateData.normalizedUrl,
    domain: privateData.domain,
    ruleDomain: privateData.ruleDomain,
    categoryId: link.categoryId,
    categoryLabel: privateData.categoryLabel,
    color: link.color,
    type,
    intent: link.intent ?? fallback.intent,
    state: link.state ?? "new",
    title: privateData.title ?? privateData.domain,
    description: privateData.description,
    imageUrl: privateData.imageUrl,
    faviconUrl: privateData.faviconUrl,
    sourceName: privateData.sourceName ?? privateData.domain,
    userDescription: privateData.userDescription,
    importedFromCommunityPostIds: link.importedFromCommunityPostIds,
    metadataStatus: link.metadataStatus ?? "pending",
    metadata: privateData.metadata ?? { kind: type },
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
  const domainLookup = blindIndex("domain.rule", parsed.ruleDomain);
  const userRule = await database
    .collection<StoredDomainRule>("domain_rules")
    .findOne({
      userId,
      $or: [{ domainLookup }, { domain: parsed.ruleDomain }],
    });
  if (userRule) {
    const builtInCategory = getBuiltInCategories().find(
      (category) => category.id === userRule.categoryId,
    );
    if (builtInCategory) return { parsed, category: builtInCategory };

    const customCategory = await database
      .collection<StoredCustomCategory>("custom_categories")
      .findOne({ userId, id: userRule.categoryId });
    if (customCategory) {
      const categoryPrivateData = customCategory.privateData
        ? decryptJson<{ label: string }>(customCategory.privateData, "category.privateData")
        : { label: customCategory.label ?? "Custom category" };
      return {
        parsed,
        category: {
          id: customCategory.id,
          label: categoryPrivateData.label,
          color: customCategory.color,
        },
      };
    }
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
  const urlLookup = blindIndex("link.url", parsed.normalizedUrl);
  const ruleLookup = blindIndex("domain.rule", parsed.ruleDomain);
  const collection = database.collection<LinkDocument>("links");
  const existing = await collection.findOne({
    userId,
    $or: [{ urlLookup }, { normalizedUrl: parsed.normalizedUrl }],
  });

  if (existing) {
    const privateData = {
      ...privateLinkData(existing),
      originalUrl: input.trim(),
      normalizedUrl: parsed.normalizedUrl,
      domain: parsed.hostname,
      ruleDomain: parsed.ruleDomain,
      categoryLabel: category.label,
    };
    await collection.updateOne(
      { _id: existing._id, userId },
      {
        $set: {
          normalizedUrl: urlLookup,
          ruleDomain: ruleLookup,
          urlLookup,
          ruleLookup,
          categoryId: category.id,
          color: category.color,
          privateData: encryptJson(privateData, "link.privateData"),
          updatedAt: now,
        },
        $unset: {
          originalUrl: "",
          domain: "",
          categoryLabel: "",
          title: "",
          description: "",
          imageUrl: "",
          faviconUrl: "",
          sourceName: "",
          userDescription: "",
          metadata: "",
        },
      },
    );
  } else {
    const privateData: LinkPrivateData = {
      originalUrl: input.trim(),
      normalizedUrl: parsed.normalizedUrl,
      domain: parsed.hostname,
      ruleDomain: parsed.ruleDomain,
      categoryLabel: category.label,
      title: parsed.hostname,
      sourceName: parsed.hostname,
      metadata: { kind: shape.type },
    };
    await collection.insertOne({
      _id: new ObjectId(),
      userId,
      normalizedUrl: urlLookup,
      ruleDomain: ruleLookup,
      urlLookup,
      ruleLookup,
      categoryId: category.id,
      color: category.color,
      type: shape.type,
      intent: shape.intent,
      state: "new",
      metadataStatus: "pending",
      openedCount: 0,
      privateData: encryptJson(privateData, "link.privateData"),
      createdAt: now,
      updatedAt: now,
    });
  }

  const link = await collection.findOne({ userId, urlLookup });
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
    const existingPrivateData = privateLinkData(link);
    const enriched = await extractLinkMetadata(existingPrivateData.normalizedUrl);
    await database.collection<LinkDocument>("links").updateOne(
      { _id: objectId, userId },
      {
        $set: {
          type: enriched.type,
          intent: enriched.intent,
          privateData: encryptJson(
            {
              ...existingPrivateData,
              title: enriched.title,
              description: enriched.description,
              imageUrl: enriched.imageUrl,
              faviconUrl: enriched.faviconUrl,
              sourceName: enriched.sourceName,
              metadata: enriched.metadata,
            } satisfies LinkPrivateData,
            "link.privateData",
          ),
          metadataStatus: "ready",
          metadataUpdatedAt: new Date(),
        },
        $unset: {
          title: "",
          description: "",
          imageUrl: "",
          faviconUrl: "",
          sourceName: "",
          metadata: "",
          metadataStartedAt: "",
        },
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
  const ruleLookup = blindIndex("domain.rule", domain);
  const collection = database.collection<LinkDocument>("links");
  const links = await collection.find(
    { userId, $or: [{ ruleLookup }, { ruleDomain: domain }] },
    { session },
  ).toArray();
  if (!links.length) return;
  await collection.bulkWrite(
    links.map((link) => ({
      updateOne: {
        filter: { _id: link._id, userId },
        update: {
          $set: {
            ruleDomain: ruleLookup,
            ruleLookup,
            categoryId: category.id,
            color: category.color,
            privateData: encryptJson(
              { ...privateLinkData(link), categoryLabel: category.label },
              "link.privateData",
            ),
            updatedAt: new Date(),
          },
          $unset: { categoryLabel: "" },
        },
      },
    })),
    { session },
  );
}

/** Reclassify private links before their custom category is deleted. */
export async function reclassifyLinksForDeletedCategory(
  userId: ObjectId,
  categoryId: string,
  session?: ClientSession,
): Promise<void> {
  const database = await getDatabase();
  const collection = database.collection<LinkDocument>("links");
  const links = await collection.find({ userId, categoryId }, { session }).toArray();
  if (!links.length) return;
  await collection.bulkWrite(
    links.map((link) => {
      const privateData = privateLinkData(link);
      const result = categorizeUrl(privateData.originalUrl);
      return {
        updateOne: {
          filter: { _id: link._id, userId },
          update: {
            $set: {
              categoryId: result.category,
              color: result.color,
              privateData: encryptJson(
                { ...privateData, categoryLabel: result.category_label },
                "link.privateData",
              ),
              updatedAt: new Date(),
            },
            $unset: { categoryLabel: "" },
          },
        },
      };
    }),
    { session },
  );
}

/** Import a community link into one private profile while preserving community context. */
export async function importCommunityLink(
  userId: ObjectId,
  input: {
    url: string;
    postId: string;
    description?: string;
    category: CategorySummary;
  },
): Promise<SavedLink> {
  const saved = await saveUserLink(userId, input.url);
  const database = await getDatabase();
  const objectId = new ObjectId(saved.id);
  const existing = await database
    .collection<LinkDocument>("links")
    .findOne({ _id: objectId, userId });
  if (!existing) throw new LinkError("Could not import this link.", "NOT_FOUND");
  await database.collection<LinkDocument>("links").updateOne(
    { _id: objectId, userId },
    {
      $set: {
        categoryId: input.category.id,
        color: input.category.color,
        privateData: encryptJson(
          {
            ...privateLinkData(existing),
            categoryLabel: input.category.label,
            userDescription: input.description?.trim().slice(0, 600) || undefined,
          },
          "link.privateData",
        ),
        updatedAt: new Date(),
      },
      $unset: { categoryLabel: "", userDescription: "" },
      $addToSet: { importedFromCommunityPostIds: input.postId },
    },
  );
  const imported = await database
    .collection<LinkDocument>("links")
    .findOne({ _id: objectId, userId });
  if (!imported) throw new LinkError("Could not import this link.", "NOT_FOUND");
  return serializeLink(imported);
}
