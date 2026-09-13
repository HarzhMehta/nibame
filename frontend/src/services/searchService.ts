import { SearchResult } from '@/types';
import { captureService } from './captureService';
import { memoryService } from './memoryService';
import { getItemTypeLabel, getEntityTypeLabel } from '@/lib/utils';

/**
 * searchService
 *
 * Simulates a local search interface querying both captured items and entities.
 * Designed to be replaced by a vector/semantic/graph retrieval API in future milestones.
 */
class SearchService {
  async search(query: string): Promise<SearchResult[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return [];
    }

    const [items, entities] = await Promise.all([
      captureService.getItems(),
      memoryService.getEntities(),
    ]);

    const results: SearchResult[] = [];

    // Search in captured items
    for (const item of items) {
      const matchedFields: string[] = [];

      if (item.title.toLowerCase().includes(trimmed)) {
        matchedFields.push('title');
      }
      if (item.content && item.content.toLowerCase().includes(trimmed)) {
        matchedFields.push('content');
      }
      if (item.url && item.url.toLowerCase().includes(trimmed)) {
        matchedFields.push('url');
      }
      if (item.tags.some((t) => t.toLowerCase().includes(trimmed))) {
        matchedFields.push('tags');
      }
      if (item.detectedEntities?.some((e) => e.toLowerCase().includes(trimmed))) {
        matchedFields.push('entities');
      }

      if (matchedFields.length > 0) {
        results.push({
          id: item.id,
          resultType: 'item',
          title: item.title,
          subtitle: item.url || (item.content ? item.content.slice(0, 100) + '...' : ''),
          snippet: item.content,
          tags: item.tags,
          category: getItemTypeLabel(item.type),
          url: item.url,
          createdAt: item.createdAt,
          matchedFields,
        });
      }
    }

    // Search in memory entities
    for (const entity of entities) {
      const matchedFields: string[] = [];

      if (entity.name.toLowerCase().includes(trimmed)) {
        matchedFields.push('name');
      }
      if (entity.description.toLowerCase().includes(trimmed)) {
        matchedFields.push('description');
      }
      if (entity.tags.some((t) => t.toLowerCase().includes(trimmed))) {
        matchedFields.push('tags');
      }
      if (entity.relationships.some((r) => r.targetEntityName.toLowerCase().includes(trimmed))) {
        matchedFields.push('relationships');
      }

      if (matchedFields.length > 0) {
        results.push({
          id: entity.id,
          resultType: 'entity',
          title: entity.name,
          subtitle: entity.description,
          snippet: entity.relationships
            .map((r) => `${r.label} ${r.targetEntityName}`)
            .join(' • '),
          tags: entity.tags,
          category: getEntityTypeLabel(entity.type),
          createdAt: entity.createdAt,
          matchedFields,
        });
      }
    }

    return results;
  }
}

export const searchService = new SearchService();
