import React, { useState, useMemo } from 'react';
import { useBrain } from '@/context/BrainContext';
import { EntityCard } from '@/components/common/EntityCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EntityType } from '@/types';
import { Sparkles, Network } from 'lucide-react';

export const MemoryPage: React.FC = () => {
  const { entities, isLoadingEntities } = useBrain();
  const [selectedFilter, setSelectedFilter] = useState<EntityType | 'all'>('all');

  const filterTabs = [
    { id: 'all', label: 'All Entities' },
    { id: 'topic', label: 'Topics' },
    { id: 'project', label: 'Projects' },
    { id: 'person', label: 'People' },
    { id: 'document', label: 'Documents' },
    { id: 'task', label: 'Tasks' },
  ] as const;

  const filteredEntities = useMemo(() => {
    if (selectedFilter === 'all') return entities;
    return entities.filter((entity) => entity.type === selectedFilter);
  }, [entities, selectedFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            Memory & Context
          </h1>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100">
            Entities
          </span>
        </div>
        <p className="text-sm text-stone-500 max-w-2xl leading-relaxed">
          nibame represents your context as connected entities and relationships, rather than rigid folders.
          Future PRs will connect this to a graph retrieval engine.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-stone-200 pb-2.5">
        {filterTabs.map((tab) => {
          const count =
            tab.id === 'all'
              ? entities.length
              : entities.filter((e) => e.type === tab.id).length;

          const isActive = selectedFilter === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors shrink-0 ${
                isActive
                  ? 'bg-stone-900 text-stone-50'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  isActive
                    ? 'bg-stone-700 text-stone-200'
                    : 'bg-stone-200 text-stone-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Entities Grid */}
      {isLoadingEntities ? (
        <LoadingSpinner message="Loading memory entities..." />
      ) : filteredEntities.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No entities found"
          description="Try switching entity categories or capture items that introduce new topics, people, or projects."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEntities.map((entity) => (
            <EntityCard key={entity.id} entity={entity} />
          ))}
        </div>
      )}

      {/* Visual notice explaining graph roadmap */}
      <div className="rounded-xl border border-stone-200/80 bg-stone-50 p-4 text-xs text-stone-500 flex items-start gap-2.5">
        <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-stone-700">Memory Graph Architecture: </span>
          The entities above demonstrate how captured items connect to people, places, topics, and tasks.
          Full graph visualization and automated entity extraction are scheduled in subsequent PRs.
        </div>
      </div>
    </div>
  );
};
