import { Entity, EntityType, Relationship } from '@/types';
import { initialMockEntities } from '@/data/mockEntities';

/**
 * memoryService
 *
 * Provides access to memory entities and their relationships.
 * Decoupled from graph database specifics so that future graph APIs
 * can be plugged in cleanly.
 */
class MemoryService {
  private entities: Entity[] = [...initialMockEntities];

  async getEntities(type?: EntityType): Promise<Entity[]> {
    if (!type) {
      return [...this.entities];
    }
    return this.entities.filter((entity) => entity.type === type);
  }

  async getEntityById(id: string): Promise<Entity | undefined> {
    return this.entities.find((entity) => entity.id === id);
  }

  async getRelationships(entityId: string): Promise<Relationship[]> {
    const entity = await this.getEntityById(entityId);
    return entity ? entity.relationships : [];
  }

  async addEntity(entity: Omit<Entity, 'id' | 'createdAt'>): Promise<Entity> {
    const newEntity: Entity = {
      ...entity,
      id: `entity-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.entities.push(newEntity);
    return newEntity;
  }
}

export const memoryService = new MemoryService();
