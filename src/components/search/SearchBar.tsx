"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { match } from "ts-pattern";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { useSearch } from "@/hooks/ui/useSearch";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";
import { SearchDropdown } from "./SearchDropdown";

export function SearchBar() {
  const router = useRouter();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const { query, setQuery, results, isSearching } = useSearch(activeProjectId);

  // The global `Mod+K` shortcut focuses the search input by bumping this token.
  const searchFocusToken = useUiStore((s) => s.searchFocusToken);
  useEffect(() => {
    if (searchFocusToken === 0) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [searchFocusToken]);

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

    match(e.key)
      .with("ArrowDown", () => {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < flatResults.length - 1 ? prev + 1 : prev,
        );
      })
      .with("ArrowUp", () => {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      })
      .with("Enter", () => {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
          navigateToResult(selectedIndex);
        } else {
          navigateToSearchPage();
        }
      })
      .with("Escape", () => {
        e.preventDefault();
        handleClose();
        inputRef.current?.blur();
      })
      .otherwise(() => {});
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset selection when query changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [query]);

  return (
    <DropdownMenu
      open={isOpen && query.trim().length > 0}
      onClose={handleClose}
      align="full"
      className="w-full"
      panelClassName="max-h-[400px] overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
      trigger={
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
            placeholder='Search… (use "quotes" for exact match)'
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-1.5 pl-9 pr-14 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-600 dark:focus:bg-neutral-800 dark:focus:ring-neutral-700"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-500">
            {typeof navigator !== "undefined" &&
            navigator.platform?.includes("Mac")
              ? "⌘K"
              : "Ctrl+K"}
          </kbd>
        </div>
      }
    >
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
    </DropdownMenu>
  );
}
