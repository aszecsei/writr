"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearch } from "@/hooks/ui/useSearch";
import { useProjectStore } from "@/store/projectStore";
import { SearchDropdown } from "./SearchDropdown";
import { useSearchShortcuts } from "./useSearchShortcuts";

export function SearchBar() {
  const router = useRouter();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const { query, setQuery, results, isSearching } = useSearch(activeProjectId);

  useSearchShortcuts(inputRef);

  const flatResults = results.flatMap((group) => group.results);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSelectedIndex(-1);
  }, []);

  const navigateToSearchPage = useCallback(() => {
    if (!activeProjectId || !query.trim()) return;
    router.push(
      `/projects/${activeProjectId}/search?q=${encodeURIComponent(query)}`,
    );
    handleClose();
    inputRef.current?.blur();
  }, [activeProjectId, query, router, handleClose]);

  const navigateToResult = useCallback(
    (index: number) => {
      const result = flatResults[index];
      if (result) {
        router.push(result.url);
        handleClose();
        setQuery("");
        inputRef.current?.blur();
      }
    },
    [flatResults, router, handleClose, setQuery],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < flatResults.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
          navigateToResult(selectedIndex);
        } else {
          navigateToSearchPage();
        }
        break;
      case "Escape":
        e.preventDefault();
        handleClose();
        inputRef.current?.blur();
        break;
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClose]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset selection when query changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [query]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-1.5 pl-9 pr-14 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-600 dark:focus:bg-neutral-800 dark:focus:ring-neutral-700"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-500">
          {typeof navigator !== "undefined" &&
          navigator.platform?.includes("Mac")
            ? "⌘K"
            : "Ctrl+K"}
        </kbd>
      </div>

      {isOpen && query.trim() && (
        <SearchDropdown
          results={results}
          query={query}
          isSearching={isSearching}
          selectedIndex={selectedIndex}
          onResultClick={() => {
            handleClose();
            setQuery("");
          }}
        />
      )}
    </div>
  );
}
