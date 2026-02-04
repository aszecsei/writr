"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type {
  PaginatedSearchResults,
  SearchableEntityType,
} from "@/lib/search";
import { searchProjectPaginated } from "@/lib/search";

const DEFAULT_PAGE_SIZE = 20;

export function useSearchPage(
  projectId: string | null,
  query: string,
  page = 1,
  entityTypeFilter?: SearchableEntityType[],
) {
  const results = useLiveQuery(
    async () => {
      if (!projectId || !query.trim()) {
        return {
          results: [],
          totalCount: 0,
          page: 1,
          pageSize: DEFAULT_PAGE_SIZE,
          totalPages: 0,
        } as PaginatedSearchResults;
      }
      return searchProjectPaginated(
        projectId,
        query,
        page,
        DEFAULT_PAGE_SIZE,
        entityTypeFilter,
      );
    },
    [projectId, query, page, entityTypeFilter?.join(",")],
    {
      results: [],
      totalCount: 0,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      totalPages: 0,
    } as PaginatedSearchResults,
  );

  return results;
}
