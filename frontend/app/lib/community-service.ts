import "server-only";

import { randomBytes } from "node:crypto";

import { MongoServerError, ObjectId } from "mongodb";

import type { AuthenticatedUser } from "./auth";
import type {
  CommunityPost,
  CommunityPostKind,
  CommunityStatus,
  CommunitySummary,
} from "./community-types";
import { classifyUrlShape, extractLinkMetadata } from "./metadata-extractor";
import { getDatabase } from "./mongodb";
import { importCommunityLink } from "./user-links";
import { importCommunityNote } from "./user-items";
import {
  categorizeUrl,
  getBuiltInCategories,
  parseUrl,
  type CategorySummary,
} from "./url-categorizer";

interface CommunityDocument {
  _id: ObjectId;
  slug: string;
  name: string;
  description: string;
  categoryId?: string;
  createdBy: ObjectId;
  status: CommunityStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface MembershipDocument {
  _id: ObjectId;
  communityId: ObjectId;
  userId: ObjectId;
  joinedAt: Date;
}

interface CommunityPostDocument {
  _id: ObjectId;
  communityId: ObjectId;
  authorId: ObjectId;
  authorAlias: string;
  kind: CommunityPostKind;
  text: string;
  url?: string;
  normalizedUrl?: string;
  title: string;
  description?: string;
  imageUrl?: string;
  sourceName?: string;
  categoryId: string;
  categoryLabel: string;
  categoryColor: string;
  metadataStatus?: "pending" | "processing" | "ready" | "failed";
  metadata?: CommunityPost["metadata"];
  metadataStartedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class CommunityError extends Error {
  constructor(
    message: string,
    readonly code:
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "NOT_JOINED"
      | "INVALID_COMMUNITY"
      | "INVALID_POST"
      | "RATE_LIMITED",
  ) {
    super(message);
  }
}

function categoryById(categoryId?: string): CategorySummary {
  const category = getBuiltInCategories().find((candidate) => candidate.id === categoryId);
  return category ?? { id: "unknown", label: "Uncategorized", color: "#777d8a" };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function authorAlias(userId: ObjectId): string {
  return "Member " + userId.toHexString().slice(-4).toLocaleUpperCase();
}

function serializePost(post: CommunityPostDocument, userId: ObjectId): CommunityPost {
  return {
    id: post._id.toHexString(),
    communityId: post.communityId.toHexString(),
    kind: post.kind,
    text: post.text,
    url: post.url,
    normalizedUrl: post.normalizedUrl,
    title: post.title,
    description: post.description,
    imageUrl: post.imageUrl,
    sourceName: post.sourceName,
    categoryId: post.categoryId,
    categoryLabel: post.categoryLabel,
    categoryColor: post.categoryColor,
    metadataStatus: post.metadataStatus,
    metadata: post.metadata,
    authorAlias: post.authorAlias,
    isOwn: post.authorId.equals(userId),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

async function membershipExists(userId: ObjectId, communityId: ObjectId): Promise<boolean> {
  const database = await getDatabase();
  return Boolean(
    await database
      .collection<MembershipDocument>("community_memberships")
      .findOne({ userId, communityId }, { projection: { _id: 1 } }),
  );
}

async function activeCommunity(communityId: ObjectId): Promise<CommunityDocument> {
  const database = await getDatabase();
  const community = await database
    .collection<CommunityDocument>("communities")
    .findOne({ _id: communityId, status: "active" });
  if (!community) throw new CommunityError("Community not found.", "NOT_FOUND");
  return community;
}

async function requireMembership(userId: ObjectId, communityId: ObjectId): Promise<void> {
  await activeCommunity(communityId);
  if (!(await membershipExists(userId, communityId))) {
    throw new CommunityError("Join this community to continue.", "NOT_JOINED");
  }
}

async function summaryFor(
  community: CommunityDocument,
  user: AuthenticatedUser,
  membershipIds: Set<string>,
  memberCounts: Map<string, number>,
  postCounts: Map<string, number>,
): Promise<CommunitySummary> {
  const category = community.categoryId ? categoryById(community.categoryId) : undefined;
  const id = community._id.toHexString();
  return {
    id,
    slug: community.slug,
    name: community.name,
    description: community.description,
    categoryId: category?.id,
    categoryLabel: category?.label,
    categoryColor: category?.color,
    status: community.status,
    memberCount: memberCounts.get(id) ?? 0,
    postCount: postCounts.get(id) ?? 0,
    isJoined: membershipIds.has(id),
    isSuperAdmin: user.isSuperAdmin,
    createdAt: community.createdAt.toISOString(),
  };
}

/** List discoverable communities with membership and finite count summaries. */
export async function listCommunities(user: AuthenticatedUser): Promise<Array<CommunitySummary>> {
  const database = await getDatabase();
  const communities = await database
    .collection<CommunityDocument>("communities")
    .find(user.isSuperAdmin ? {} : { status: "active" })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  const ids = communities.map((community) => community._id);
  const memberships = await database
    .collection<MembershipDocument>("community_memberships")
    .find({ userId: user.id, communityId: { $in: ids } })
    .toArray();
  const memberGroups = ids.length
    ? await database
        .collection<MembershipDocument>("community_memberships")
        .aggregate<{ _id: ObjectId; count: number }>([
          { $match: { communityId: { $in: ids } } },
          { $group: { _id: "$communityId", count: { $sum: 1 } } },
        ])
        .toArray()
    : [];
  const postGroups = ids.length
    ? await database
        .collection<CommunityPostDocument>("community_posts")
        .aggregate<{ _id: ObjectId; count: number }>([
          { $match: { communityId: { $in: ids } } },
          { $group: { _id: "$communityId", count: { $sum: 1 } } },
        ])
        .toArray()
    : [];
  const membershipIds = new Set(memberships.map((entry) => entry.communityId.toHexString()));
  const memberCounts = new Map(memberGroups.map((entry) => [entry._id.toHexString(), entry.count]));
  const postCounts = new Map(postGroups.map((entry) => [entry._id.toHexString(), entry.count]));
  return Promise.all(
    communities.map((community) =>
      summaryFor(community, user, membershipIds, memberCounts, postCounts),
    ),
  );
}

/** Load one community by slug without exposing private account identifiers. */
export async function getCommunityBySlug(
  user: AuthenticatedUser,
  slug: string,
): Promise<CommunitySummary> {
  const database = await getDatabase();
  const community = await database.collection<CommunityDocument>("communities").findOne({
    slug,
    ...(user.isSuperAdmin ? {} : { status: "active" }),
  });
  if (!community) throw new CommunityError("Community not found.", "NOT_FOUND");
  const [isJoined, memberCount, postCount] = await Promise.all([
    membershipExists(user.id, community._id),
    database.collection<MembershipDocument>("community_memberships").countDocuments({
      communityId: community._id,
    }),
    database.collection<CommunityPostDocument>("community_posts").countDocuments({
      communityId: community._id,
    }),
  ]);
  return summaryFor(
    community,
    user,
    isJoined ? new Set([community._id.toHexString()]) : new Set(),
    new Map([[community._id.toHexString(), memberCount]]),
    new Map([[community._id.toHexString(), postCount]]),
  );
}

/** Create a community only for the database-designated super admin. */
export async function createCommunity(
  user: AuthenticatedUser,
  input: { name: string; description: string; categoryId?: string },
): Promise<CommunitySummary> {
  if (!user.isSuperAdmin) throw new CommunityError("Super admin access required.", "FORBIDDEN");
  const name = input.name.trim();
  const description = input.description.trim();
  if (name.length < 3 || name.length > 60 || description.length < 10 || description.length > 500) {
    throw new CommunityError(
      "Use a name between 3 and 60 characters and a description between 10 and 500 characters.",
      "INVALID_COMMUNITY",
    );
  }
  if (input.categoryId && categoryById(input.categoryId).id === "unknown") {
    throw new CommunityError("Choose a valid category.", "INVALID_COMMUNITY");
  }

  const baseSlug = slugify(name);
  if (!baseSlug) throw new CommunityError("Choose a valid community name.", "INVALID_COMMUNITY");
  const database = await getDatabase();
  const exists = await database.collection<CommunityDocument>("communities").findOne({ slug: baseSlug });
  const slug = exists ? baseSlug + "-" + randomBytes(2).toString("hex") : baseSlug;
  const now = new Date();
  const document = {
    slug,
    name,
    description,
    categoryId: input.categoryId,
    createdBy: user.id,
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  };
  try {
    const inserted = await database
      .collection<Omit<CommunityDocument, "_id">>("communities")
      .insertOne(document);
    await database.collection<Omit<MembershipDocument, "_id">>("community_memberships").insertOne({
      communityId: inserted.insertedId,
      userId: user.id,
      joinedAt: now,
    });
    return {
      id: inserted.insertedId.toHexString(),
      slug,
      name,
      description,
      categoryId: input.categoryId,
      categoryLabel: input.categoryId ? categoryById(input.categoryId).label : undefined,
      categoryColor: input.categoryId ? categoryById(input.categoryId).color : undefined,
      status: "active",
      memberCount: 1,
      postCount: 0,
      isJoined: true,
      isSuperAdmin: true,
      createdAt: now.toISOString(),
    };
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new CommunityError("A community with this name already exists.", "INVALID_COMMUNITY");
    }
    throw error;
  }
}

/** Archive or restore a community as the super admin. */
export async function setCommunityArchived(
  user: AuthenticatedUser,
  communityId: string,
  archived: boolean,
): Promise<void> {
  if (!user.isSuperAdmin) throw new CommunityError("Super admin access required.", "FORBIDDEN");
  if (!ObjectId.isValid(communityId)) throw new CommunityError("Community not found.", "NOT_FOUND");
  const database = await getDatabase();
  const result = await database.collection<CommunityDocument>("communities").updateOne(
    { _id: new ObjectId(communityId) },
    { $set: { status: archived ? "archived" : "active", updatedAt: new Date() } },
  );
  if (!result.matchedCount) throw new CommunityError("Community not found.", "NOT_FOUND");
}

/** Join an active community without approval. */
export async function joinCommunity(userId: ObjectId, communityId: string): Promise<void> {
  if (!ObjectId.isValid(communityId)) throw new CommunityError("Community not found.", "NOT_FOUND");
  const objectId = new ObjectId(communityId);
  await activeCommunity(objectId);
  const database = await getDatabase();
  await database.collection<MembershipDocument>("community_memberships").updateOne(
    { communityId: objectId, userId },
    { $setOnInsert: { joinedAt: new Date() } },
    { upsert: true },
  );
}

/** Leave a community without altering existing authored posts. */
export async function leaveCommunity(userId: ObjectId, communityId: string): Promise<void> {
  if (!ObjectId.isValid(communityId)) return;
  const database = await getDatabase();
  await database.collection<MembershipDocument>("community_memberships").deleteOne({
    communityId: new ObjectId(communityId),
    userId,
  });
}

/** Return one finite page of posts for a joined member. */
export async function listCommunityPosts(
  userId: ObjectId,
  communityId: string,
  before?: string,
): Promise<{ posts: Array<CommunityPost>; nextCursor?: string }> {
  if (!ObjectId.isValid(communityId)) throw new CommunityError("Community not found.", "NOT_FOUND");
  const objectId = new ObjectId(communityId);
  await requireMembership(userId, objectId);
  const database = await getDatabase();
  const beforeDate = before ? new Date(before) : undefined;
  const posts = await database
    .collection<CommunityPostDocument>("community_posts")
    .find({
      communityId: objectId,
      ...(beforeDate && !Number.isNaN(beforeDate.getTime()) ? { createdAt: { $lt: beforeDate } } : {}),
    })
    .sort({ createdAt: -1 })
    .limit(25)
    .toArray();
  return {
    posts: posts.slice(0, 24).map((post) => serializePost(post, userId)),
    nextCursor: posts.length > 24 ? posts[23].createdAt.toISOString() : undefined,
  };
}

/** Create a rate-limited link or note inside a joined community. */
export async function createCommunityPost(
  userId: ObjectId,
  communityId: string,
  input: { kind: CommunityPostKind; text: string; url?: string; categoryId?: string },
): Promise<CommunityPost> {
  if (!ObjectId.isValid(communityId)) throw new CommunityError("Community not found.", "NOT_FOUND");
  const objectId = new ObjectId(communityId);
  await requireMembership(userId, objectId);
  const database = await getDatabase();
  const recentPosts = await database.collection<CommunityPostDocument>("community_posts").countDocuments({
    communityId: objectId,
    authorId: userId,
    createdAt: { $gte: new Date(Date.now() - 60_000) },
  });
  if (recentPosts >= 5) {
    throw new CommunityError("Please wait before posting again.", "RATE_LIMITED");
  }

  const text = input.text.trim();
  if (input.kind !== "link" && input.kind !== "note") {
    throw new CommunityError("Choose Link or Note.", "INVALID_POST");
  }
  if (input.kind === "note" && (!text || text.length > 4000)) {
    throw new CommunityError("Write between 1 and 4,000 characters.", "INVALID_POST");
  }
  if (input.kind === "link" && text.length > 600) {
    throw new CommunityError("Keep link descriptions under 600 characters.", "INVALID_POST");
  }

  let normalizedUrl: string | undefined;
  let originalUrl: string | undefined;
  let title = text.slice(0, 100) || "Community note";
  let category = categoryById(input.categoryId);
  let metadataStatus: CommunityPostDocument["metadataStatus"];
  let metadata: CommunityPost["metadata"];
  let sourceName: string | undefined;
  if (input.kind === "link") {
    const parsed = parseUrl(input.url ?? "");
    if (!parsed) throw new CommunityError("Enter a valid HTTP(S) link.", "INVALID_POST");
    const categorized = categorizeUrl(parsed.normalizedUrl);
    category =
      input.categoryId && categoryById(input.categoryId).id !== "unknown"
        ? categoryById(input.categoryId)
        : {
            id: categorized.category,
            label: categorized.category_label,
            color: categorized.color,
          };
    const shape = classifyUrlShape(new URL(parsed.normalizedUrl));
    normalizedUrl = parsed.normalizedUrl;
    originalUrl = (input.url ?? "").trim();
    title = parsed.hostname;
    sourceName = parsed.hostname;
    metadataStatus = "pending";
    metadata = { kind: shape.type };
  }

  const now = new Date();
  const document = {
    communityId: objectId,
    authorId: userId,
    authorAlias: authorAlias(userId),
    kind: input.kind,
    text,
    url: originalUrl,
    normalizedUrl,
    title,
    sourceName,
    categoryId: category.id,
    categoryLabel: category.label,
    categoryColor: category.color,
    metadataStatus,
    metadata,
    createdAt: now,
    updatedAt: now,
  };
  const result = await database
    .collection<Omit<CommunityPostDocument, "_id">>("community_posts")
    .insertOne(document);
  return serializePost({ _id: result.insertedId, ...document }, userId);
}

/** Enrich one community link post using the existing safe extractor. */
export async function enrichCommunityPost(postId: string): Promise<void> {
  if (!ObjectId.isValid(postId)) return;
  const database = await getDatabase();
  const objectId = new ObjectId(postId);
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
  const claim = await database.collection<CommunityPostDocument>("community_posts").updateOne(
    {
      _id: objectId,
      kind: "link",
      $or: [
        { metadataStatus: "pending" },
        { metadataStatus: "processing", metadataStartedAt: { $lt: staleBefore } },
      ],
    },
    { $set: { metadataStatus: "processing", metadataStartedAt: new Date() } },
  );
  if (claim.modifiedCount !== 1) return;
  const post = await database
    .collection<CommunityPostDocument>("community_posts")
    .findOne({ _id: objectId });
  if (!post?.normalizedUrl) return;
  try {
    const enriched = await extractLinkMetadata(post.normalizedUrl);
    await database.collection<CommunityPostDocument>("community_posts").updateOne(
      { _id: objectId },
      {
        $set: {
          title: enriched.title,
          description: enriched.description,
          imageUrl: enriched.imageUrl,
          sourceName: enriched.sourceName,
          metadata: enriched.metadata,
          metadataStatus: "ready",
          updatedAt: new Date(),
        },
        $unset: { metadataStartedAt: "" },
      },
    );
  } catch {
    await database.collection<CommunityPostDocument>("community_posts").updateOne(
      { _id: objectId },
      {
        $set: { metadataStatus: "failed", updatedAt: new Date() },
        $unset: { metadataStartedAt: "" },
      },
    );
  }
}

/** Edit only the current user's own post text or category. */
export async function updateCommunityPost(
  userId: ObjectId,
  postId: string,
  input: { text: string; categoryId?: string },
): Promise<CommunityPost> {
  if (!ObjectId.isValid(postId)) throw new CommunityError("Post not found.", "NOT_FOUND");
  const database = await getDatabase();
  const objectId = new ObjectId(postId);
  const post = await database
    .collection<CommunityPostDocument>("community_posts")
    .findOne({ _id: objectId, authorId: userId });
  if (!post) throw new CommunityError("Post not found.", "NOT_FOUND");
  await requireMembership(userId, post.communityId);
  const text = input.text.trim();
  const limit = post.kind === "link" ? 600 : 4000;
  if ((post.kind === "note" && !text) || text.length > limit) {
    throw new CommunityError("Enter valid post text.", "INVALID_POST");
  }
  const category = input.categoryId ? categoryById(input.categoryId) : categoryById(post.categoryId);
  if (input.categoryId && category.id === "unknown") {
    throw new CommunityError("Choose a valid category.", "INVALID_POST");
  }
  await database.collection<CommunityPostDocument>("community_posts").updateOne(
    { _id: objectId, authorId: userId },
    {
      $set: {
        text,
        categoryId: category.id,
        categoryLabel: category.label,
        categoryColor: category.color,
        updatedAt: new Date(),
      },
    },
  );
  const updated = await database
    .collection<CommunityPostDocument>("community_posts")
    .findOne({ _id: objectId, authorId: userId });
  if (!updated) throw new CommunityError("Post not found.", "NOT_FOUND");
  return serializePost(updated, userId);
}

/** Delete only the current user's own post. */
export async function deleteCommunityPost(userId: ObjectId, postId: string): Promise<boolean> {
  if (!ObjectId.isValid(postId)) return false;
  const database = await getDatabase();
  const post = await database
    .collection<CommunityPostDocument>("community_posts")
    .findOne({ _id: new ObjectId(postId), authorId: userId });
  if (!post) return false;
  await requireMembership(userId, post.communityId);
  const result = await database.collection<CommunityPostDocument>("community_posts").deleteOne({
    _id: new ObjectId(postId),
    authorId: userId,
  });
  return result.deletedCount === 1;
}

/** Import one joined-community post into the user's private profile. */
export async function importCommunityPost(
  userId: ObjectId,
  postId: string,
  timezone: string,
): Promise<{ kind: CommunityPostKind; id: string }> {
  if (!ObjectId.isValid(postId)) throw new CommunityError("Post not found.", "NOT_FOUND");
  const database = await getDatabase();
  const post = await database
    .collection<CommunityPostDocument>("community_posts")
    .findOne({ _id: new ObjectId(postId) });
  if (!post) throw new CommunityError("Post not found.", "NOT_FOUND");
  await requireMembership(userId, post.communityId);
  if (post.kind === "link" && post.normalizedUrl) {
    const link = await importCommunityLink(userId, {
      url: post.normalizedUrl,
      postId,
      description: post.text,
      category: {
        id: post.categoryId,
        label: post.categoryLabel,
        color: post.categoryColor,
      },
    });
    return { kind: "link", id: link.id };
  }
  const note = await importCommunityNote(userId, {
    postId,
    text: post.text,
    categoryId: post.categoryId,
    timezone,
  });
  return { kind: "note", id: note.id };
}
