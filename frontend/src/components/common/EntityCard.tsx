import React from 'react';
import { Entity, EntityType } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getEntityTypeLabel } from '@/lib/utils';
import {
  User,
  Building2,
  FolderGit2,
  BookOpen,
  CheckSquare,
  Hash,
  ArrowRight,
} from 'lucide-react';

export interface EntityCardProps {
  entity: Entity;
}

export const EntityCard: React.FC<EntityCardProps> = ({ entity }) => {
  const getEntityIcon = (type: EntityType) => {
    switch (type) {
      case 'person':
        return <User className="h-4 w-4 text-violet-600" />;
      case 'company':
        return <Building2 className="h-4 w-4 text-emerald-600" />;
      case 'project':
        return <FolderGit2 className="h-4 w-4 text-blue-600" />;
      case 'document':
        return <BookOpen className="h-4 w-4 text-amber-600" />;
      case 'task':
        return <CheckSquare className="h-4 w-4 text-rose-600" />;
      case 'topic':
      default:
        return <Hash className="h-4 w-4 text-stone-600" />;
    }
  };

  const getEntityBadgeVariant = (type: EntityType) => {
    switch (type) {
      case 'person':
        return 'secondary' as const;
      case 'company':
      case 'project':
        return 'info' as const;
      case 'task':
        return 'warning' as const;
      case 'document':
        return 'default' as const;
      case 'topic':
      default:
        return 'outline' as const;
    }
  };

  return (
    <Card hoverable className="border-stone-200/90 hover:border-stone-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 shrink-0">
            {getEntityIcon(entity.type)}
          </div>
          <Badge variant={getEntityBadgeVariant(entity.type)}>
            {getEntityTypeLabel(entity.type)}
          </Badge>
        </div>
      </div>

      <div className="mt-2.5">
        <h3 className="font-semibold text-stone-900 text-base">{entity.name}</h3>
        <p className="mt-1 text-xs text-stone-600 leading-relaxed">
          {entity.description}
        </p>
      </div>

      {/* Relationships */}
      {entity.relationships.length > 0 && (
        <div className="mt-3.5 space-y-1.5 border-t border-stone-100 pt-3">
          <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider block">
            Relationships ({entity.relationships.length})
          </span>
          <div className="space-y-1">
            {entity.relationships.map((rel) => (
              <div
                key={rel.id}
                className="flex items-center gap-1.5 text-xs text-stone-600 bg-stone-50 rounded-md px-2.5 py-1.5 border border-stone-100"
              >
                <span className="text-stone-400 font-medium text-[11px] lowercase">
                  {rel.label}
                </span>
                <ArrowRight className="h-3 w-3 text-stone-400 shrink-0" />
                <span className="font-medium text-stone-800">
                  {rel.targetEntityName}
                </span>
                <span className="ml-auto text-[10px] text-stone-400">
                  {getEntityTypeLabel(rel.targetEntityType)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {entity.tags.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1 border-t border-stone-100 pt-2.5">
          {entity.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 font-medium"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
};
