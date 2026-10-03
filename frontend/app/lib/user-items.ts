import "server-only";

import { ObjectId, type UpdateFilter } from "mongodb";

import type { UserItem, UserItemKind, UserItemStatus } from "./item-types";
import { getDatabase } from "./mongodb";

interface UserItemDocument {
  _id: ObjectId;
  userId: ObjectId;
  kind: UserItemKind;
  text: string;
  status: UserItemStatus;
  remindAt?: Date;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  categoryId?: string;
  sourceCommunityPostId?: string;
}

export type UserItemAction = "complete" | "reopen" | "archive";

export class UserItemError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_ITEM" | "NOT_FOUND",
  ) {
    super(message);
  }
}

function serializeItem(item: UserItemDocument): UserItem {
  return {
    id: item._id.toHexString(),
    kind: item.kind,
    text: item.text,
    status: item.status,
    remindAt: item.remindAt?.toISOString(),
    timezone: item.timezone,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    completedAt: item.completedAt?.toISOString(),
    categoryId: item.categoryId,
    sourceCommunityPostId: item.sourceCommunityPostId,
  };
}

/** Load tasks and notes belonging to one authenticated user. */
export async function getUserItems(userId: ObjectId): Promise<Array<UserItem>> {
  const database = await getDatabase();
  const items = await database
    .collection<UserItemDocument>("items")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .limit(500)
    .toArray();
  return items.map(serializeItem);
}

/** Create one explicit task or note. */
export async function createUserItem(
  userId: ObjectId,
  input: {
    kind: UserItemKind;
    text: string;
    remindAt?: string;
    timezone: string;
  },
): Promise<UserItem> {
  const text = input.text.trim();
  if (!text || text.length > 4000) {
    throw new UserItemError("Write between 1 and 4,000 characters.", "INVALID_ITEM");
  }
  if (input.kind !== "task" && input.kind !== "note") {
    throw new UserItemError("Choose Task or Note.", "INVALID_ITEM");
  }

  let remindAt: Date | undefined;
  if (input.remindAt) {
    remindAt = new Date(input.remindAt);
    if (Number.isNaN(remindAt.getTime())) {
      throw new UserItemError("Choose a valid reminder time.", "INVALID_ITEM");
    }
  }

  const now = new Date();
  const document = {
    userId,
    kind: input.kind,
    text,
    status: "active" as const,
    remindAt,
    timezone: input.timezone.slice(0, 100) || "UTC",
    createdAt: now,
    updatedAt: now,
  };
  const database = await getDatabase();
  const result = await database
    .collection<Omit<UserItemDocument, "_id">>("items")
    .insertOne(document);
  return serializeItem({ _id: result.insertedId, ...document });
}

/** Complete, reopen, or archive one item owned by the current user. */
export async function updateUserItem(
  userId: ObjectId,
  id: string,
  action: UserItemAction,
): Promise<UserItem> {
  if (!ObjectId.isValid(id)) throw new UserItemError("Item not found.", "NOT_FOUND");
  const database = await getDatabase();
  const objectId = new ObjectId(id);
  const now = new Date();

  const update: UpdateFilter<UserItemDocument> =
    action === "complete"
      ? { $set: { status: "done" as const, completedAt: now, updatedAt: now } }
      : action === "reopen"
        ? {
            $set: { status: "active" as const, updatedAt: now },
            $unset: { completedAt: "" },
          }
        : { $set: { status: "archived" as const, updatedAt: now } };
  await database
    .collection<UserItemDocument>("items")
    .updateOne({ _id: objectId, userId }, update);

  const item = await database
    .collection<UserItemDocument>("items")
    .findOne({ _id: objectId, userId });
  if (!item) throw new UserItemError("Item not found.", "NOT_FOUND");
  return serializeItem(item);
}

/** Delete one item only when it belongs to the current user. */
export async function deleteUserItem(userId: ObjectId, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const database = await getDatabase();
  const result = await database
    .collection<UserItemDocument>("items")
    .deleteOne({ _id: new ObjectId(id), userId });
  return result.deletedCount === 1;
}

/** Import one community note once into the user's private notes. */
export async function importCommunityNote(
  userId: ObjectId,
  input: {
    postId: string;
    text: string;
    categoryId?: string;
    timezone: string;
  },
): Promise<UserItem> {
  const database = await getDatabase();
  const existing = await database.collection<UserItemDocument>("items").findOne({
    userId,
    sourceCommunityPostId: input.postId,
  });
  if (existing) return serializeItem(existing);

  const now = new Date();
  const document = {
    userId,
    kind: "note" as const,
    text: input.text.trim().slice(0, 4000),
    status: "active" as const,
    timezone: input.timezone.slice(0, 100) || "UTC",
    categoryId: input.categoryId,
    sourceCommunityPostId: input.postId,
    createdAt: now,
    updatedAt: now,
  };
  const result = await database
    .collection<Omit<UserItemDocument, "_id">>("items")
    .insertOne(document);
  return serializeItem({ _id: result.insertedId, ...document });
}
