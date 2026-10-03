export type UserItemKind = "task" | "note";
export type UserItemStatus = "active" | "done" | "archived";

export interface UserItem {
  id: string;
  kind: UserItemKind;
  text: string;
  status: UserItemStatus;
  remindAt?: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  categoryId?: string;
  sourceCommunityPostId?: string;
}
