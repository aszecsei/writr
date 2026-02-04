"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  SearchFilters,
  SearchPagination,
  SearchResultItem,
} from "@/components/search";
import { useSearchPage } from "@/hooks/useSearchPage";
import type { SearchableEntityType } from "@/lib/search";
import { entityConfigs } from "@/lib/search";

export default function SearchPage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const query = searchParams.get("q") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const typeParam = searchParams.get("type");

  const selectedTypes = useMemo(() => {
    if (!typeParam) return [] as SearchableEntityType[];
    return typeParam.split(",").filter(Boolean) as SearchableEntityType[];
  }, [typeParam]);

  const results = useSearchPage(
    params.projectId,
    query,
    page,
    selectedTypes.length > 0 ? selectedTypes : undefined,
  );

  const updateParams = useCallback(
    (updates: { page?: number; types?: SearchableEntityType[] }) => {
      const newParams = new URLSearchParams(searchParams.toString());

      if (updates.page !== undefined) {
        if (updates.page === 1) {
          newParams.delete("page");
        } else {
          newParams.set("page", String(updates.page));
        }
      }

      if (updates.types !== undefined) {
        if (updates.types.length === 0) {
          newParams.delete("type");
        } else {
          newParams.set("type", updates.types.join(","));
        }
      }

      router.push(
        `/projects/${params.projectId}/search?${newParams.toString()}`,
      );
    },
    [router, params.projectId, searchParams],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      updateParams({ page: newPage });
    },
    [updateParams],
  );

  const handleTypesChange = useCallback(
    (types: SearchableEntityType[]) => {
      updateParams({ page: 1, types });
    },
    [updateParams],
  );

  if (!query.trim()) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Search
        </h1>
        <p className="mt-4 text-zinc-500 dark:text-zinc-400">
          Enter a search term to find content across your project.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Search Results for &quot;{query}&quot;
        </h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {results.totalCount} {results.totalCount === 1 ? "result" : "results"}
        </span>
      </div>

      <div className="mb-6">
        <SearchFilters
          selectedTypes={selectedTypes}
          onTypesChange={handleTypesChange}
        />
      </div>

      {results.results.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">
            No results found for &quot;{query}&quot;
            {selectedTypes.length > 0 && " with the selected filters"}.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.results.map((result) => {
            const config = entityConfigs[result.entityType];
            return (
              <div
                key={`${result.entityType}-${result.id}`}
                className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <SearchResultItem
                  icon={config.icon}
                  title={result.title}
                  subtitle={result.subtitle}
                  snippet={result.snippet}
                  matchField={result.matchField}
                  url={result.url}
                  query={query}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        <SearchPagination
          page={results.page}
          totalPages={results.totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
