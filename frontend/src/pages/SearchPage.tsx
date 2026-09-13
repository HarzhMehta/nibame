import React, { useState, useEffect, useCallback } from 'react';
import { SearchResult } from '@/types';
import { searchService } from '@/services/searchService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Search, Sparkles, ExternalLink, Hash, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const sampleQueries = ['Kafka', 'Distributed Systems', 'Mumbai', 'Martin Kleppmann', 'GSoC'];

  const executeSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      // Simulate light async retrieval time
      await new Promise((resolve) => setTimeout(resolve, 80));
      const searchResults = await searchService.search(trimmed);
      setResults(searchResults);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    executeSearch(suggestion);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  };

  // Perform search automatically if user types with a slight debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    const timer = setTimeout(() => {
      executeSearch(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, executeSearch]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          Search Your Brain
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Find anything you have captured or connected across items, entities, and topics.
        </p>
      </div>

      {/* Search Input Form */}
      <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by keyword, topic, person, or URL..."
            className="pl-10 pr-10 h-11 text-sm bg-white"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 hover:text-stone-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" size="md" className="h-11 px-5">
          Search
        </Button>
      </form>

      {/* Quick Search Suggestions */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
        <span className="font-medium text-stone-400">Suggestions:</span>
        {sampleQueries.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => handleSuggestionClick(item)}
            className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900 transition-colors"
          >
            <Hash className="h-3 w-3 text-stone-400" />
            {item}
          </button>
        ))}
      </div>

      {/* Results / State Section */}
      <div className="pt-2">
        {isSearching ? (
          <LoadingSpinner message="Searching through your personal context..." />
        ) : !hasSearched ? (
          <EmptyState
            icon={Search}
            title="Start typing to search"
            description="Query across your inbox items, topics, people, and context. Retrieval happens locally in this foundation PR."
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={Search}
            title={`No results found for "${query}"`}
            description="Try searching with different terms, keywords, or tags."
            actionLabel="Clear Search"
            onAction={handleClear}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-stone-500 pb-1">
              <span>
                Found <strong className="text-stone-900">{results.length}</strong> {results.length === 1 ? 'match' : 'matches'}
              </span>
              <span className="text-[11px] text-stone-400">Client-side retrieval</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {results.map((result) => (
                <Card
                  key={`${result.resultType}-${result.id}`}
                  hoverable
                  className="border-stone-200/90 hover:border-stone-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={result.resultType === 'entity' ? 'secondary' : 'info'}
                        >
                          {result.category}
                        </Badge>
                        {result.matchedFields.length > 0 && (
                          <span className="text-[10px] text-stone-400 font-mono">
                            matched in {result.matchedFields.join(', ')}
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold text-stone-900 text-sm">
                        {result.url ? (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 transition-colors inline-flex items-center gap-1.5"
                          >
                            {result.title}
                            <ExternalLink className="h-3 w-3 text-stone-400" />
                          </a>
                        ) : (
                          result.title
                        )}
                      </h3>
                      {result.subtitle && (
                        <p className="text-xs text-stone-600 line-clamp-2">
                          {result.subtitle}
                        </p>
                      )}
                    </div>

                    {result.createdAt && (
                      <span className="text-[11px] text-stone-400 shrink-0">
                        {formatDate(result.createdAt)}
                      </span>
                    )}
                  </div>

                  {result.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1 border-t border-stone-100 pt-2">
                      {result.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="rounded-xl border border-stone-200/80 bg-stone-50 p-4 text-xs text-stone-500 flex items-start gap-2.5">
        <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-stone-700">Retrieval Architecture: </span>
          In upcoming milestones, this search interface can connect to contextual retrieval, hybrid search, and graph query APIs without changing this UI view.
        </div>
      </div>
    </div>
  );
};
