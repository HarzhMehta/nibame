/**
 * nibame domain types
 *
 * Minimal frontend domain models representing items, entities, relationships,
 * and search queries. Designed so real backend APIs can map cleanly to them.
 */

export type ItemType = 'url' | 'note' | 'github_repo' | 'article' | 'video';

export type ItemStatus = 'inbox' | 'processed' | 'archived';

export interface MemoryItem {
  id: string;
  title: string;
  content?: string;
  url?: string;
  type: ItemType;
  tags: string[];
  status: ItemStatus;
  createdAt: string; // ISO 8601 string
  detectedEntities?: string[]; // e.g. ["Kafka", "Distributed Systems"]
  metadata?: {
    author?: string;
    domain?: string;
    readingTimeMinutes?: number;
    stars?: number;
  };
}

export type EntityType = 'person' | 'company' | 'topic' | 'project' | 'task' | 'document';

export type RelationshipType =
  | 'works_at'
  | 'knows'
  | 'lives_in'
  | 'about'
  | 'related_to'
  | 'belongs_to'
  | 'discusses'
  | 'implements'
  | 'mentions';

export interface Relationship {
  id: string;
  type: RelationshipType;
  label: string; // Human-friendly display label (e.g. "works at", "about")
  targetEntityId: string;
  targetEntityName: string;
  targetEntityType: EntityType;
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  relationships: Relationship[];
  tags: string[];
  createdAt: string;
}

export interface CaptureInput {
  title: string;
  content?: string;
  url?: string;
  type?: ItemType;
  tags?: string[];
}

export type SearchResultType = 'item' | 'entity';

export interface SearchResult {
  id: string;
  resultType: SearchResultType;
  title: string;
  subtitle: string;
  snippet?: string;
  tags: string[];
  category: string; // e.g. "Note", "Topic", "Person"
  url?: string;
  createdAt?: string;
  matchedFields: string[];
}
