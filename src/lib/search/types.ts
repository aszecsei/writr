import type { LucideIcon } from "lucide-react";

export type SearchableEntityType =
  | "chapter"
  | "character"
  | "location"
  | "timelineEvent"
  | "styleGuideEntry"
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
