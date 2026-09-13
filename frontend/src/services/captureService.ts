import { MemoryItem, CaptureInput, ItemType } from '@/types';
import { initialMockItems } from '@/data/mockItems';
import { detectItemType } from '@/lib/utils';

/**
 * captureService
 *
 * Provides a clean interface for capturing and retrieving memory items.
 * Currently uses local memory storage initialized with mock items.
 * In the future, this can be swapped with real API calls without modifying UI components.
 */
class CaptureService {
  private items: MemoryItem[] = [...initialMockItems];

  async getItems(): Promise<MemoryItem[]> {
    // Return a shallow copy of items sorted by newest first
    return [...this.items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getItemsByType(type?: ItemType): Promise<MemoryItem[]> {
    const all = await this.getItems();
    if (!type) return all;
    return all.filter((item) => item.type === type);
  }

  async captureItem(input: CaptureInput): Promise<MemoryItem> {
    const detectedType = input.type || (input.url ? detectItemType(input.url) : 'note');

    // Basic heuristic entity detection for mock demonstration
    const detectedEntities: string[] = [];
    const fullText = `${input.title} ${input.content || ''} ${input.url || ''}`.toLowerCase();
    if (fullText.includes('kafka')) detectedEntities.push('Kafka');
    if (fullText.includes('distributed')) detectedEntities.push('Distributed Systems');
    if (fullText.includes('mumbai')) detectedEntities.push('Mumbai');
    if (fullText.includes('neo4j') || fullText.includes('graph')) detectedEntities.push('Neo4j');
    if (fullText.includes('gsoc')) detectedEntities.push('GSoC 2026');

    const newItem: MemoryItem = {
      id: `item-${Date.now()}`,
      title: input.title.trim(),
      content: input.content?.trim(),
      url: input.url?.trim(),
      type: detectedType,
      tags: input.tags || [],
      status: 'inbox',
      createdAt: new Date().toISOString(),
      detectedEntities: detectedEntities.length > 0 ? detectedEntities : undefined,
      metadata: input.url
        ? {
            domain: this.extractDomain(input.url),
          }
        : undefined,
    };

    this.items.unshift(newItem);
    return newItem;
  }

  async deleteItem(id: string): Promise<boolean> {
    const initialLen = this.items.length;
    this.items = this.items.filter((item) => item.id !== id);
    return this.items.length < initialLen;
  }

  private extractDomain(urlStr: string): string | undefined {
    try {
      const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
      return url.hostname.replace(/^www\./, '');
    } catch {
      return undefined;
    }
  }
}

export const captureService = new CaptureService();
