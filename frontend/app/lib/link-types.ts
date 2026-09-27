export type LinkContentType =
  | "article"
  | "audio"
  | "video"
  | "social"
  | "repository"
  | "product"
  | "place"
  | "event"
  | "job"
  | "recipe"
  | "documentation"
  | "webpage";

export type LinkIntent =
  | "read"
  | "listen"
  | "watch"
  | "try"
  | "buy"
  | "visit"
  | "attend"
  | "apply"
  | "cook"
  | "reference";
export type LinkState = "new" | "active" | "archived";
export type MetadataStatus = "pending" | "processing" | "ready" | "failed";

export interface LinkMetadata {
  kind: LinkContentType;
  author?: string;
  channel?: string;
  durationSeconds?: number;
  readingMinutes?: number;
  language?: string;
  stars?: number;
  price?: number;
  currency?: string;
  brand?: string;
  address?: string;
}

export interface SavedLink {
  id: string;
  url: string;
  normalizedUrl: string;
  domain: string;
  ruleDomain: string;
  categoryId: string;
  categoryLabel: string;
  color: string;
  type: LinkContentType;
  intent: LinkIntent;
  state: LinkState;
  title: string;
  description?: string;
  imageUrl?: string;
  faviconUrl?: string;
  sourceName: string;
  metadataStatus: MetadataStatus;
  metadata: LinkMetadata;
  openedCount: number;
  lastOpenedAt?: string;
  resurfaceAfter?: string;
  createdAt: string;
  updatedAt: string;
}
