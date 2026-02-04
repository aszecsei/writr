"use client";

import { Loader2 } from "lucide-react";
import type { GroupedSearchResults } from "@/lib/search";
import { SearchResultItem } from "./SearchResultItem";

interface SearchDropdownProps {
  results: GroupedSearchResults[];
  query: string;
  isSearching: boolean;
  selectedIndex: number;
  onResultClick: () => void;
}

export function SearchDropdown({
  results,
  query,
  isSearching,
  selectedIndex,
  onResultClick,
}: SearchDropdownProps) {
  if (!query.trim()) {
    return null;
  }

  const flatResults = results.flatMap((group) => group.results);
  const hasResults = flatResults.length > 0;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[400px] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      {isSearching && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500">
          <Loader2 size={12} className="animate-spin" />
          Searching...
        </div>
      )}

      {!isSearching && !hasResults && (
        <div className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No results found for &quot;{query}&quot;
        </div>
      )}

      {hasResults && (
        <>
          {results.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.entityType}>
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <GroupIcon size={12} />
                  {group.labelPlural}
                </div>
                {group.results.map((result) => {
                  const globalIndex = flatResults.findIndex(
                    (r) =>
                      r.id === result.id && r.entityType === result.entityType,
                  );
                  return (
                    <SearchResultItem
                      key={`${result.entityType}-${result.id}`}
                      icon={group.icon}
                      title={result.title}
                      subtitle={result.subtitle}
                      snippet={result.snippet}
                      matchField={result.matchField}
                      url={result.url}
                      query={query}
                      isSelected={globalIndex === selectedIndex}
                      onClick={onResultClick}
                    />
                  );
                })}
              </div>
            );
          })}
          <div className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
            Press Enter to see all results
          </div>
        </>
      )}
    </div>
  );
}
