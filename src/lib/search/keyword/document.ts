import { entityConfigs } from "../entity-config";
import type { SearchableEntityType } from "../types";

export interface IndexedDoc {
  docId: string;
  entityId: string;
  entityType: SearchableEntityType;
  displayTitle: string;
  subtitle?: string;
  url: string;
  // Searchable field values, keyed by field name. Only fields populated on
  // this entity appear here. Used both for indexing (minisearch reads these
  // via extractField) and snippet extraction (we look up the matched field).
  fields: Record<string, string>;
}

export function makeDocId(
  entityType: SearchableEntityType,
  entityId: string,
): string {
  return `${entityType}:${entityId}`;
}

function fieldToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string").join("\n");
  }
  return "";
}

export function entityToDoc<T extends { id: string }>(args: {
  entity: T;
  entityType: SearchableEntityType;
  projectId: string;
  titleField: string;
  subtitleField?: string;
}): IndexedDoc {
  const { entity, entityType, projectId, titleField, subtitleField } = args;
  const config = entityConfigs[entityType];
  const record = entity as unknown as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const f of config.searchableFields) {
    const s = fieldToString(record[f]);
    if (s) fields[f] = s;
  }
  return {
    docId: makeDocId(entityType, entity.id),
    entityId: entity.id,
    entityType,
    displayTitle: (record[titleField] as string | undefined) ?? "",
    subtitle: subtitleField
      ? ((record[subtitleField] as string | undefined) ?? undefined)
      : undefined,
    url: config.buildUrl(projectId, entity.id),
    fields,
  };
}

export const ALL_INDEXED_FIELDS: string[] = Array.from(
  new Set(Object.values(entityConfigs).flatMap((c) => c.searchableFields)),
);
