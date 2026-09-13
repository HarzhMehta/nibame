import React, { useState, useMemo } from 'react';
import { useBrain } from '@/context/BrainContext';
import { ItemCard } from '@/components/common/ItemCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { ItemType } from '@/types';
import { Inbox, Plus } from 'lucide-react';

export const InboxPage: React.FC = () => {
  const { items, isLoadingItems, openCaptureModal } = useBrain();
  const [selectedFilter, setSelectedFilter] = useState<ItemType | 'all'>('all');

  const filterTabs = [
    { id: 'all', label: 'All' },
    { id: 'url', label: 'Links' },
    { id: 'note', label: 'Notes' },
    { id: 'github_repo', label: 'Repos' },
    { id: 'article', label: 'Articles' },
    { id: 'video', label: 'Videos' },
  ] as const;

  const filteredItems = useMemo(() => {
    if (selectedFilter === 'all') return items;
    return items.filter((item) => item.type === selectedFilter);
  }, [items, selectedFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            Inbox
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Capture first, organize later. Everything you save lands here.
          </p>
        </div>

        <Button
          onClick={openCaptureModal}
          className="self-start sm:self-auto gap-2"
        >
          <Plus className="h-4 w-4 text-blue-400" />
          Capture Item
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-stone-200 pb-2.5">
        {filterTabs.map((tab) => {
          const count =
            tab.id === 'all'
              ? items.length
              : items.filter((i) => i.type === tab.id).length;

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

      {/* Content Area */}
      {isLoadingItems ? (
        <LoadingSpinner message="Loading your captured items..." />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            selectedFilter === 'all'
              ? 'Your inbox is empty'
              : `No ${selectedFilter} items found`
          }
          description={
            selectedFilter === 'all'
              ? 'Throw anything into nibame without deciding where it belongs. Use the Capture button to get started.'
              : 'Try selecting a different filter or capture a new item in this category.'
          }
          actionLabel="Capture to Brain"
          onAction={openCaptureModal}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};
