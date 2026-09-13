import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Inbox,
  Network,
  Search,
  Plus,
  User,
  Briefcase,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBrain } from '@/context/BrainContext';
import { Badge } from '@/components/ui/Badge';

interface SidebarProps {
  onCloseMobile?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile, className }) => {
  const { items, openCaptureModal } = useBrain();
  const inboxCount = items.filter((i) => i.status === 'inbox').length;

  const mainNav = [
    {
      to: '/inbox',
      label: 'Inbox',
      icon: Inbox,
      badge: inboxCount > 0 ? String(inboxCount) : undefined,
    },
    {
      to: '/memory',
      label: 'Memory',
      icon: Sparkles,
    },
    {
      to: '/search',
      label: 'Search',
      icon: Search,
    },
  ];

  const futureSections = [
    { label: 'Personal', icon: User },
    { label: 'Work', icon: Briefcase },
    { label: 'Learning', icon: GraduationCap },
    { label: 'Network', icon: Network },
  ];

  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-col border-r border-stone-200 bg-white/80 backdrop-blur-md select-none',
        className
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-stone-100">
        <NavLink
          to="/inbox"
          onClick={onCloseMobile}
          className="flex items-center gap-2.5 group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-stone-50 transition-transform group-hover:scale-105">
            <Sparkles className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <span className="font-semibold tracking-tight text-stone-900">nibame</span>
            <span className="block text-[10px] text-stone-400 font-medium leading-none">second brain</span>
          </div>
        </NavLink>
      </div>

      {/* Quick Capture Button */}
      <div className="p-3">
        <button
          onClick={() => {
            openCaptureModal();
            onCloseMobile?.();
          }}
          className="flex w-full items-center justify-between rounded-xl bg-stone-900 px-3.5 py-2.5 text-xs font-medium text-stone-50 shadow-sm transition-all hover:bg-stone-800 active:bg-stone-950 group"
          aria-label="Capture to brain"
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-400 transition-transform group-hover:rotate-90" />
            Capture
          </span>
          <kbd className="hidden rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-mono text-stone-300 sm:inline-block border border-stone-700">
            C
          </kbd>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
        {/* Core Navigation */}
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Core
          </p>
          {mainNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-stone-100 text-stone-900 font-semibold'
                      : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                  )
                }
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-stone-500" />
                  {item.label}
                </span>
                {item.badge && (
                  <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Future Context Layers */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-3 pb-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Contexts
            </p>
          </div>
          {futureSections.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-stone-400 cursor-not-allowed group"
                title={`${item.label} context layer planned for future PRs`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-stone-400" />
                  {item.label}
                </span>
                <Badge variant="outline" className="text-[10px] text-stone-400 border-stone-200">
                  Soon
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer info */}
      <div className="border-t border-stone-200/80 p-4">
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span>nibame v0.1.0</span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            local
          </span>
        </div>
      </div>
    </aside>
  );
};
