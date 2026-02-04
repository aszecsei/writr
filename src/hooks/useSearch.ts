"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useDeferredValue, useMemo, useState } from "react";
import type { GroupedSearchResults } from "@/lib/search";
import { getTotalResultCount, searchProject } from "@/lib/search";

const MAX_PER_CATEGORY = 5;

export function useSearch(projectId: string | null) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const isSearching = query !== deferredQuery;

  const results = useLiveQuery(
    async () => {
      if (!projectId || !deferredQuery.trim()) {
        return [] as GroupedSearchResults[];
      }
      return searchProject(projectId, deferredQuery, MAX_PER_CATEGORY);
    },
    [projectId, deferredQuery],
    [] as GroupedSearchResults[],
  );

  const totalCount = useMemo(() => getTotalResultCount(results), [results]);

  return {
    query,
    setQuery,
    results,
    isSearching,
    totalCount,
  };
}
