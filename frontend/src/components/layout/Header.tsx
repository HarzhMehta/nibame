import React from 'react';
import { Menu, Plus, Search, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBrain } from '@/context/BrainContext';
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  onToggleMobile: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobile }) => {
  const { openCaptureModal } = useBrain();
  const navigate = useNavigate();
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/inbox':
        return 'Inbox';
      case '/memory':
        return 'Memory';
      case '/search':
        return 'Search';
      default:
        return 'nibame';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-stone-200/80 bg-white/80 px-4 sm:px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {/* Mobile toggle */}
        <button
          onClick={onToggleMobile}
          className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 md:hidden focus:outline-none focus:ring-2 focus:ring-stone-400"
          aria-label="Open mobile menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile Logo */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-stone-900 text-stone-50">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <span className="font-semibold text-stone-900 text-sm">nibame</span>
        </div>

        {/* Current page title (desktop) */}
        <h1 className="hidden text-base font-semibold text-stone-900 md:block">
          {getPageTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Fast Search button if not already on search page */}
        {location.pathname !== '/search' && (
          <button
            onClick={() => navigate('/search')}
            className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50/70 px-3 py-1.5 text-xs text-stone-500 hover:border-stone-300 hover:bg-stone-100 hover:text-stone-800 transition-colors"
            aria-label="Go to search"
          >
            <Search className="h-3.5 w-3.5 text-stone-400" />
            <span className="hidden sm:inline">Search brain...</span>
          </button>
        )}

        {/* Capture trigger */}
        <Button
          onClick={openCaptureModal}
          size="sm"
          className="gap-1.5 shadow-xs"
        >
          <Plus className="h-4 w-4 text-blue-400" />
          <span>Capture</span>
          <kbd className="hidden sm:inline-block rounded bg-stone-800 px-1 text-[10px] font-mono text-stone-400 border border-stone-700">
            Ctrl+K
          </kbd>
        </Button>
      </div>
    </header>
  );
};
