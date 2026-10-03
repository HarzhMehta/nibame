import type { LinkMetadata, MetadataStatus } from "./link-types";

export type CommunityStatus = "active" | "archived";
export type CommunityPostKind = "link" | "note";

export interface CommunitySummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId?: string;
  categoryLabel?: string;
  categoryColor?: string;
  status: CommunityStatus;
  memberCount: number;
  postCount: number;
  isJoined: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  communityId: string;
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
  metadataStatus?: MetadataStatus;
  metadata?: LinkMetadata;
  authorAlias: string;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
}
