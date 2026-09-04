import type { LucideIcon } from "lucide-react";

export type SearchableEntityType =
  | "chapter"
  | "character"
  | "location"
  | "timelineEvent"
  | "styleGuideEntry"
  | "guardrailEntry"
  | "worldbuildingDoc"
  | "outlineCell";

export interface SearchResult {
  id: string;
  entityType: SearchableEntityType;
  title: string;
  subtitle?: string;
  snippet: string;
  matchField: string;
  url: string;
}

export interface EntityGroupConfig {
  type: SearchableEntityType;
  label: string;
  labelPlural: string;
  icon: LucideIcon;
  buildUrl: (projectId: string, entityId: string) => string;
  searchableFields: string[];
  /**
   * How to load and title this entity type's rows for indexing. Omitted for
   * types (currently just outlineCell) whose display title needs a join the
   * generic loader can't express — those are indexed by hand.
   */
  titleField?: string;
  subtitleField?: string;
  loadEntities?: (
    projectId: string,
  ) => Promise<Array<Record<string, unknown> & { id: string }>>;
}

export interface GroupedSearchResults {
  entityType: SearchableEntityType;
  label: string;
  labelPlural: string;
  icon: LucideIcon;
  results: SearchResult[];
}

export interface PaginatedSearchResults {
  results: SearchResult[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
