import "server-only";

import { randomUUID } from "node:crypto";

import { MongoServerError, type ClientSession, type ObjectId } from "mongodb";

import { getDatabase, getMongoClient } from "./mongodb";
import { updateLinksForDomain } from "./user-links";
import {
  categorizeUrl,
  categoryNameExists,
  createCustomCategory,
  getBuiltInCategories,
  type CustomCategory,
  type SessionDomainRule,
} from "./url-categorizer";

interface CustomCategoryDocument extends CustomCategory {
  _id: ObjectId;
  userId: ObjectId;
  normalizedLabel: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DomainRuleDocument extends SessionDomainRule {
  _id: ObjectId;
  userId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  customCategories: Array<CustomCategory>;
  customDomainRules: Array<SessionDomainRule>;
}

export class PreferenceError extends Error {
  constructor(
    message: string,
    readonly code: "CATEGORY_EXISTS" | "CATEGORY_NOT_FOUND",
  ) {
    super(message);
  }
}

/** Load a user's persisted categories and domain overrides. */
export async function getUserPreferences(userId: ObjectId): Promise<UserPreferences> {
  const database = await getDatabase();
  const [categoryDocuments, ruleDocuments] = await Promise.all([
    database
      .collection<CustomCategoryDocument>("custom_categories")
      .find({ userId })
      .sort({ createdAt: 1 })
      .toArray(),
    database
      .collection<DomainRuleDocument>("domain_rules")
      .find({ userId })
      .sort({ createdAt: 1 })
      .toArray(),
  ]);

  return {
    customCategories: categoryDocuments.map((category) => ({
      id: category.id,
      label: category.label,
      color: category.color,
      domains: category.domains,
      domain_count: category.domain_count,
      examples: category.examples,
      isCustom: true,
    })),
    customDomainRules: ruleDocuments.map((rule) => ({
      domain: rule.domain,
      categoryId: rule.categoryId,
    })),
  };
}

async function upsertDomainRule(
  userId: ObjectId,
  rule: SessionDomainRule,
  session?: ClientSession,
): Promise<void> {
  const database = await getDatabase();
  const now = new Date();
  await database.collection<DomainRuleDocument>("domain_rules").updateOne(
    { userId, domain: rule.domain },
    {
      $set: { categoryId: rule.categoryId, updatedAt: now },
      $setOnInsert: { userId, domain: rule.domain, createdAt: now },
    },
    { upsert: true, session },
  );
}

/** Persist a new custom category and its first domain rule atomically. */
export async function createUserCategory(
  userId: ObjectId,
  name: string,
  domain: string,
): Promise<{ category: CustomCategory; rule: SessionDomainRule }> {
  const database = await getDatabase();
  const normalizedLabel = name.trim().toLocaleLowerCase();
  if (categoryNameExists(name, getBuiltInCategories())) {
    throw new PreferenceError("A category with this name already exists.", "CATEGORY_EXISTS");
  }

  const categoryCount = await database
    .collection<CustomCategoryDocument>("custom_categories")
    .countDocuments({ userId });
  const category = {
    ...createCustomCategory(name, domain, categoryCount),
    id: `custom-${randomUUID()}`,
  };
  const rule = { domain, categoryId: category.id };
  const now = new Date();
  const document = {
    ...category,
    userId,
    normalizedLabel,
    createdAt: now,
    updatedAt: now,
  };

  const client = await getMongoClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await database
        .collection<Omit<CustomCategoryDocument, "_id">>("custom_categories")
        .insertOne(document, { session });
      await upsertDomainRule(userId, rule, session);
      await updateLinksForDomain(userId, domain, category, session);
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new PreferenceError("A category with this name already exists.", "CATEGORY_EXISTS");
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return { category, rule };
}

/** Persist or replace one domain assignment for the current user. */
export async function setUserDomainRule(
  userId: ObjectId,
  domain: string,
  categoryId: string,
): Promise<SessionDomainRule> {
  const database = await getDatabase();
  const builtInCategory = getBuiltInCategories().find((category) => category.id === categoryId);
  const customCategory = builtInCategory
    ? null
    : await database
        .collection<CustomCategoryDocument>("custom_categories")
        .findOne({ userId, id: categoryId });
  const category = builtInCategory ?? customCategory;
  if (!category) {
    throw new PreferenceError("Choose a valid category.", "CATEGORY_NOT_FOUND");
  }

  const rule = { domain, categoryId };
  await upsertDomainRule(userId, rule);
  if (customCategory && !customCategory.domains.includes(domain)) {
    await database.collection<CustomCategoryDocument>("custom_categories").updateOne(
      { userId, id: categoryId, domains: { $ne: domain } },
      {
        $addToSet: { domains: domain, examples: domain },
        $inc: { domain_count: 1 },
        $set: { updatedAt: new Date() },
      },
    );
  }
  await updateLinksForDomain(userId, domain, category);
  return rule;
}

/** Delete one custom category and safely reclassify its saved links. */
export async function deleteUserCategory(
  userId: ObjectId,
  categoryId: string,
): Promise<void> {
  const database = await getDatabase();
  const client = await getMongoClient();
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      const category = await database
        .collection<CustomCategoryDocument>("custom_categories")
        .findOne({ userId, id: categoryId }, { session });
      if (!category) {
        throw new PreferenceError("Category not found.", "CATEGORY_NOT_FOUND");
      }

      const affectedLinks = await database
        .collection<{
          _id: ObjectId;
          userId: ObjectId;
          originalUrl: string;
          categoryId: string;
        }>("links")
        .find({ userId, categoryId }, { session })
        .toArray();

      if (affectedLinks.length) {
        await database.collection("links").bulkWrite(
          affectedLinks.map((link) => {
            const result = categorizeUrl(link.originalUrl);
            return {
              updateOne: {
                filter: { _id: link._id, userId },
                update: {
                  $set: {
                    categoryId: result.category,
                    categoryLabel: result.category_label,
                    color: result.color,
                    updatedAt: new Date(),
                  },
                },
              },
            };
          }),
          { session },
        );
      }

      await database.collection("domain_rules").deleteMany(
        { userId, categoryId },
        { session },
      );
      await database.collection("custom_categories").deleteOne(
        { userId, id: categoryId },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
}
