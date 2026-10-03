import "server-only";

import { randomUUID } from "node:crypto";

import { MongoServerError, type ClientSession, type ObjectId } from "mongodb";

import { blindIndex, decryptJson, encryptJson } from "./data-encryption";
import { getDatabase, getMongoClient } from "./mongodb";
import {
  reclassifyLinksForDeletedCategory,
  updateLinksForDomain,
} from "./user-links";
import {
  categoryNameExists,
  createCustomCategory,
  getBuiltInCategories,
  type CustomCategory,
  type SessionDomainRule,
} from "./url-categorizer";

interface CustomCategoryDocument {
  _id: ObjectId;
  userId: ObjectId;
  id: string;
  label?: string;
  color: string;
  domains?: Array<string>;
  domain_count: number;
  examples?: Array<string>;
  isCustom: true;
  normalizedLabel?: string;
  normalizedLabelLookup?: string;
  privateData?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DomainRuleDocument {
  _id: ObjectId;
  userId: ObjectId;
  domain?: string;
  domainLookup?: string;
  categoryId: string;
  privateData?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomCategoryPrivateData {
  label: string;
  domains: Array<string>;
  examples: Array<string>;
}

interface DomainRulePrivateData {
  domain: string;
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

function categoryPrivateData(category: CustomCategoryDocument): CustomCategoryPrivateData {
  if (category.privateData) {
    return decryptJson<CustomCategoryPrivateData>(category.privateData, "category.privateData");
  }
  return {
    label: category.label ?? "Custom category",
    domains: category.domains ?? [],
    examples: category.examples ?? [],
  };
}

function serializeCategory(category: CustomCategoryDocument): CustomCategory {
  const privateData = categoryPrivateData(category);
  return {
    id: category.id,
    label: privateData.label,
    color: category.color,
    domains: privateData.domains,
    domain_count: category.domain_count,
    examples: privateData.examples,
    isCustom: true,
  };
}

function rulePrivateData(rule: DomainRuleDocument): DomainRulePrivateData {
  if (rule.privateData) {
    return decryptJson<DomainRulePrivateData>(rule.privateData, "domainRule.privateData");
  }
  return { domain: rule.domain ?? "" };
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
    customCategories: categoryDocuments.map(serializeCategory),
    customDomainRules: ruleDocuments.map((rule) => ({
      domain: rulePrivateData(rule).domain,
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
  const domainLookup = blindIndex("domain.rule", rule.domain);
  await database.collection<DomainRuleDocument>("domain_rules").updateOne(
    { userId, $or: [{ domainLookup }, { domain: rule.domain }] },
    {
      $set: {
        domain: domainLookup,
        domainLookup,
        categoryId: rule.categoryId,
        privateData: encryptJson({ domain: rule.domain }, "domainRule.privateData"),
        updatedAt: now,
      },
      $setOnInsert: { userId, createdAt: now },
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
  const normalizedLabelLookup = blindIndex("category.label", normalizedLabel);
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
    userId,
    id: category.id,
    color: category.color,
    domain_count: category.domain_count,
    isCustom: true as const,
    normalizedLabel: normalizedLabelLookup,
    normalizedLabelLookup,
    privateData: encryptJson(
      {
        label: category.label,
        domains: category.domains,
        examples: category.examples,
      } satisfies CustomCategoryPrivateData,
      "category.privateData",
    ),
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
  const serializedCustomCategory = customCategory ? serializeCategory(customCategory) : null;
  const category = builtInCategory ?? serializedCustomCategory;
  if (!category) {
    throw new PreferenceError("Choose a valid category.", "CATEGORY_NOT_FOUND");
  }

  const rule = { domain, categoryId };
  await upsertDomainRule(userId, rule);
  if (customCategory && serializedCustomCategory && !serializedCustomCategory.domains.includes(domain)) {
    const domains = [...serializedCustomCategory.domains, domain];
    const examples = [...new Set([...serializedCustomCategory.examples, domain])];
    await database.collection<CustomCategoryDocument>("custom_categories").updateOne(
      { userId, id: categoryId },
      {
        $inc: { domain_count: 1 },
        $set: {
          privateData: encryptJson(
            {
              label: serializedCustomCategory.label,
              domains,
              examples,
            } satisfies CustomCategoryPrivateData,
            "category.privateData",
          ),
          updatedAt: new Date(),
        },
        $unset: { label: "", domains: "", examples: "" },
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

      await reclassifyLinksForDeletedCategory(userId, categoryId, session);

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
