import { db } from "@/db/database";
import { entityConfigs, entityTypeOrder } from "./entity-config";
import {
  extractSnippet,
  getFirstMatchingField,
  textContainsQuery,
} from "./highlight";
import type {
  GroupedSearchResults,
  PaginatedSearchResults,
  SearchableEntityType,
  SearchResult,
} from "./types";

function searchEntity<T extends { id: string }>(
  entity: T,
  entityType: SearchableEntityType,
  projectId: string,
  query: string,
  titleField: string,
  subtitleField?: string,
): SearchResult | null {
  const config = entityConfigs[entityType];
  const entityRecord = entity as unknown as Record<string, unknown>;

  const match = getFirstMatchingField(
    entityRecord,
    config.searchableFields,
    query,
  );
  if (!match) return null;

  const title = entityRecord[titleField] as string;
  const subtitle = subtitleField
    ? (entityRecord[subtitleField] as string | undefined)
    : undefined;

  return {
    id: entity.id,
    entityType,
    title,
    subtitle,
    snippet: extractSnippet(match.value, query),
    matchField: match.field,
    url: config.buildUrl(projectId, entity.id),
  };
}

async function searchChapters(
  projectId: string,
  query: string,
): Promise<SearchResult[]> {
  const chapters = await db.chapters.where({ projectId }).toArray();
  const results: SearchResult[] = [];

  for (const chapter of chapters) {
    const fields = entityConfigs.chapter.searchableFields;
    if (
      fields.some((field) =>
        textContainsQuery(
          (chapter as Record<string, unknown>)[field] as string,
          query,
        ),
      )
    ) {
      const result = searchEntity(
        chapter,
        "chapter",
        projectId,
        query,
        "title",
      );
      if (result) results.push(result);
    }
  }

  return results;
}

async function searchCharacters(
  projectId: string,
  query: string,
): Promise<SearchResult[]> {
  const characters = await db.characters.where({ projectId }).toArray();
  const results: SearchResult[] = [];

  for (const character of characters) {
    const fields = entityConfigs.character.searchableFields;
    const charRecord = character as Record<string, unknown>;
    if (
      fields.some((field) =>
        textContainsQuery(charRecord[field] as string | string[], query),
      )
    ) {
      const result = searchEntity(
        character,
        "character",
        projectId,
        query,
        "name",
        "role",
      );
      if (result) results.push(result);
    }
  }

  return results;
}

async function searchLocations(
  projectId: string,
  query: string,
): Promise<SearchResult[]> {
  const locations = await db.locations.where({ projectId }).toArray();
  const results: SearchResult[] = [];

  for (const location of locations) {
    const fields = entityConfigs.location.searchableFields;
    if (
      fields.some((field) =>
        textContainsQuery(
          (location as Record<string, unknown>)[field] as string,
          query,
        ),
      )
    ) {
      const result = searchEntity(
        location,
        "location",
        projectId,
        query,
        "name",
      );
      if (result) results.push(result);
    }
  }

  return results;
}

async function searchTimelineEvents(
  projectId: string,
  query: string,
): Promise<SearchResult[]> {
  const events = await db.timelineEvents.where({ projectId }).toArray();
  const results: SearchResult[] = [];

  for (const event of events) {
    const fields = entityConfigs.timelineEvent.searchableFields;
    if (
      fields.some((field) =>
        textContainsQuery(
          (event as Record<string, unknown>)[field] as string,
          query,
        ),
      )
    ) {
      const result = searchEntity(
        event,
        "timelineEvent",
        projectId,
        query,
        "title",
      );
      if (result) results.push(result);
    }
  }

  return results;
}

async function searchStyleGuideEntries(
  projectId: string,
  query: string,
): Promise<SearchResult[]> {
  const entries = await db.styleGuideEntries.where({ projectId }).toArray();
  const results: SearchResult[] = [];

  for (const entry of entries) {
    const fields = entityConfigs.styleGuideEntry.searchableFields;
    if (
      fields.some((field) =>
        textContainsQuery(
          (entry as Record<string, unknown>)[field] as string,
          query,
        ),
      )
    ) {
      const result = searchEntity(
        entry,
        "styleGuideEntry",
        projectId,
        query,
        "title",
        "category",
      );
      if (result) results.push(result);
    }
  }

  return results;
}

async function searchWorldbuildingDocs(
  projectId: string,
  query: string,
): Promise<SearchResult[]> {
  const docs = await db.worldbuildingDocs.where({ projectId }).toArray();
  const results: SearchResult[] = [];

  for (const doc of docs) {
    const fields = entityConfigs.worldbuildingDoc.searchableFields;
    const docRecord = doc as Record<string, unknown>;
    if (
      fields.some((field) =>
        textContainsQuery(docRecord[field] as string | string[], query),
      )
    ) {
      const result = searchEntity(
        doc,
        "worldbuildingDoc",
        projectId,
        query,
        "title",
      );
      if (result) results.push(result);
    }
  }

  return results;
}

export async function searchProject(
  projectId: string,
  query: string,
  maxPerCategory = 5,
): Promise<GroupedSearchResults[]> {
  if (!query.trim()) return [];

  const [
    chapters,
    characters,
    locations,
    timelineEvents,
    styleGuideEntries,
    worldbuildingDocs,
  ] = await Promise.all([
    searchChapters(projectId, query),
    searchCharacters(projectId, query),
    searchLocations(projectId, query),
    searchTimelineEvents(projectId, query),
    searchStyleGuideEntries(projectId, query),
    searchWorldbuildingDocs(projectId, query),
  ]);

  const allResults: Record<SearchableEntityType, SearchResult[]> = {
    chapter: chapters,
    character: characters,
    location: locations,
    timelineEvent: timelineEvents,
    styleGuideEntry: styleGuideEntries,
    worldbuildingDoc: worldbuildingDocs,
  };

  const grouped: GroupedSearchResults[] = [];

  for (const entityType of entityTypeOrder) {
    const results = allResults[entityType];
    if (results.length > 0) {
      const config = entityConfigs[entityType];
      grouped.push({
        entityType,
        label: config.label,
        labelPlural: config.labelPlural,
        icon: config.icon,
        results: results.slice(0, maxPerCategory),
      });
    }
  }

  return grouped;
}

export async function searchProjectPaginated(
  projectId: string,
  query: string,
  page = 1,
  pageSize = 20,
  entityTypeFilter?: SearchableEntityType[],
): Promise<PaginatedSearchResults> {
  if (!query.trim()) {
    return { results: [], totalCount: 0, page, pageSize, totalPages: 0 };
  }

  const searchPromises: Promise<SearchResult[]>[] = [];
  const typesToSearch = entityTypeFilter?.length
    ? entityTypeFilter
    : entityTypeOrder;

  for (const entityType of typesToSearch) {
    switch (entityType) {
      case "chapter":
        searchPromises.push(searchChapters(projectId, query));
        break;
      case "character":
        searchPromises.push(searchCharacters(projectId, query));
        break;
      case "location":
        searchPromises.push(searchLocations(projectId, query));
        break;
      case "timelineEvent":
        searchPromises.push(searchTimelineEvents(projectId, query));
        break;
      case "styleGuideEntry":
        searchPromises.push(searchStyleGuideEntries(projectId, query));
        break;
      case "worldbuildingDoc":
        searchPromises.push(searchWorldbuildingDocs(projectId, query));
        break;
    }
  }

  const resultsArrays = await Promise.all(searchPromises);
  const allResults = resultsArrays.flat();

  const totalCount = allResults.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedResults = allResults.slice(startIndex, startIndex + pageSize);

  return {
    results: paginatedResults,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

export function getTotalResultCount(grouped: GroupedSearchResults[]): number {
  return grouped.reduce((sum, group) => sum + group.results.length, 0);
}
