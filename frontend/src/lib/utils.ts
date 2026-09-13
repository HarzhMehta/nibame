import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ItemType, EntityType } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return 'Recently';
  }
}

export function getItemTypeLabel(type: ItemType): string {
  switch (type) {
    case 'github_repo':
      return 'GitHub Repo';
    case 'article':
      return 'Article';
    case 'video':
      return 'Video';
    case 'url':
      return 'Link';
    case 'note':
      return 'Note';
    default:
      return 'Item';
  }
}

export function getEntityTypeLabel(type: EntityType): string {
  switch (type) {
    case 'person':
      return 'Person';
    case 'company':
      return 'Company';
    case 'topic':
      return 'Topic';
    case 'project':
      return 'Project';
    case 'task':
      return 'Task';
    case 'document':
      return 'Document';
    default:
      return 'Entity';
  }
}

export function detectItemType(input: string): ItemType {
  const trimmed = input.trim();
  if (trimmed.includes('github.com/')) {
    return 'github_repo';
  }
  if (trimmed.includes('youtube.com/') || trimmed.includes('youtu.be/')) {
    return 'video';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return 'url';
  }
  return 'note';
}
