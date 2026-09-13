import React from 'react';
import { MemoryItem, ItemType } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDate, getItemTypeLabel } from '@/lib/utils';
import {
  FileText,
  Github,
  Globe,
  Video,
  Bookmark,
  ExternalLink,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { useBrain } from '@/context/BrainContext';

export interface ItemCardProps {
  item: MemoryItem;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item }) => {
  const { deleteItem } = useBrain();

  const getItemIcon = (type: ItemType) => {
    switch (type) {
      case 'github_repo':
        return <Github className="h-4 w-4 text-stone-700" />;
      case 'video':
        return <Video className="h-4 w-4 text-rose-600" />;
      case 'article':
        return <FileText className="h-4 w-4 text-amber-600" />;
      case 'url':
        return <Globe className="h-4 w-4 text-blue-600" />;
      case 'note':
      default:
        return <Bookmark className="h-4 w-4 text-stone-600" />;
    }
  };

  const getBadgeVariant = (type: ItemType) => {
    switch (type) {
      case 'video':
        return 'warning' as const;
      case 'url':
      case 'github_repo':
        return 'info' as const;
      case 'article':
        return 'secondary' as const;
      default:
        return 'default' as const;
    }
  };

  return (
    <Card hoverable className="group relative transition-all border-stone-200/90 hover:border-stone-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 shrink-0">
            {getItemIcon(item.type)}
          </div>
          <Badge variant={getBadgeVariant(item.type)}>
            {getItemTypeLabel(item.type)}
          </Badge>
          {item.metadata?.domain && (
            <span className="text-xs text-stone-400 font-mono">
              {item.metadata.domain}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
              title="Open external link"
              aria-label={`Open link for ${item.title}`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            onClick={() => deleteItem(item.id)}
            className="rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete item"
            aria-label={`Delete ${item.title}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <h3 className="font-semibold text-stone-900 text-sm leading-snug">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition-colors inline-flex items-center gap-1"
            >
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </h3>

        {item.content && (
          <p className="mt-1.5 text-xs text-stone-600 leading-relaxed line-clamp-3">
            {item.content}
          </p>
        )}
      </div>

      {/* Detected connections/entities */}
      {item.detectedEntities && item.detectedEntities.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-stone-500">
          <Sparkles className="h-3 w-3 text-blue-500 shrink-0" />
          <span className="text-[11px] text-stone-400">Context:</span>
          <div className="flex flex-wrap gap-1">
            {item.detectedEntities.map((ent) => (
              <span
                key={ent}
                className="rounded bg-blue-50/70 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
              >
                {ent}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags and timestamp */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600 font-medium"
            >
              #{tag}
            </span>
          ))}
        </div>
        <span className="text-[11px] text-stone-400 font-medium">
          {formatDate(item.createdAt)}
        </span>
      </div>
    </Card>
  );
};
