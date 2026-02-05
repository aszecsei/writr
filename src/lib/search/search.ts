import type { EntityTable } from "dexie";
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

async function searchTable<T extends { id: string }>(
  table: EntityTable<T, "id">,
  projectId: string,
  query: string,
  entityType: SearchableEntityType,
  titleField: string,
  subtitleField?: string,
): Promise<SearchResult[]> {
  const entities = (await table.where({ projectId }).toArray()) as T[];
  return entities
    .map((e) =>
      searchEntity(e, entityType, projectId, query, titleField, subtitleField),
    )
    .filter((r): r is SearchResult => r !== null);
}

async function searchOutlineCells(
  projectId: string,
  query: string,
): Promise<SearchResult[]> {
  const [cells, rows, columns] = await Promise.all([
    db.outlineGridCells.where({ projectId }).toArray(),
    db.outlineGridRows.where({ projectId }).toArray(),
    db.outlineGridColumns.where({ projectId }).toArray(),
  ]);

  const rowMap = new Map(rows.map((r) => [r.id, r]));
  const columnMap = new Map(columns.map((c) => [c.id, c]));

  const results: SearchResult[] = [];

  for (const cell of cells) {
    if (!textContainsQuery(cell.content, query)) continue;

    const row = rowMap.get(cell.rowId);
    const column = columnMap.get(cell.columnId);
    if (!row || !column) continue;

    const rowLabel = row.label || `Row ${row.order + 1}`;
    const title = `${rowLabel} - ${column.title}`;

    results.push({
      id: cell.id,
      entityType: "outlineCell",
      title,
      subtitle: column.title,
      snippet: extractSnippet(cell.content, query),
      matchField: "content",
      url: entityConfigs.outlineCell.buildUrl(projectId, cell.id),
    });
  }

  return results;
}

const searchFunctions: Record<
  SearchableEntityType,
  (projectId: string, query: string) => Promise<SearchResult[]>
> = {
  chapter: (pid, q) => searchTable(db.chapters, pid, q, "chapter", "title"),
  character: (pid, q) =>
    searchTable(db.characters, pid, q, "character", "name", "role"),
  location: (pid, q) => searchTable(db.locations, pid, q, "location", "name"),
  timelineEvent: (pid, q) =>
    searchTable(db.timelineEvents, pid, q, "timelineEvent", "title"),
  styleGuideEntry: (pid, q) =>
    searchTable(
      db.styleGuideEntries,
      pid,
      q,
      "styleGuideEntry",
      "title",
      "category",
    ),
  worldbuildingDoc: (pid, q) =>
    searchTable(db.worldbuildingDocs, pid, q, "worldbuildingDoc", "title"),
  outlineCell: searchOutlineCells,
};

export async function searchProject(
  projectId: string,
  query: string,
  maxPerCategory = 5,
): Promise<GroupedSearchResults[]> {
  if (!query.trim()) return [];

  const allResults = await Promise.all(
    entityTypeOrder.map((type) => searchFunctions[type](projectId, query)),
  );

  const grouped: GroupedSearchResults[] = [];

  for (let i = 0; i < entityTypeOrder.length; i++) {
    const entityType = entityTypeOrder[i];
    const results = allResults[i];
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

  const typesToSearch = entityTypeFilter?.length
    ? entityTypeFilter
    : entityTypeOrder;

  const resultsArrays = await Promise.all(
    typesToSearch.map((type) => searchFunctions[type](projectId, query)),
  );
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
