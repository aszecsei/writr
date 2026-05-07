import type * as Y from "yjs";
import { z } from "zod/v4";
import {
  ChapterSchema,
  CharacterRelationshipSchema,
  CharacterSchema,
  LocationSchema,
  OutlineGridCellSchema,
  OutlineGridColumnSchema,
  OutlineGridRowSchema,
  type Project,
  ProjectSchema,
  StyleGuideEntrySchema,
  TimelineEventSchema,
  WorldbuildingDocSchema,
} from "@/db/schemas";

export const PROJECT_DOC_VERSION = 1;

export const ProjectDocMetaSchema = z.object({
  mode: z.literal("project"),
  projectId: z.uuid(),
  activeChapterId: z.uuid().nullable(),
  revision: z.number().int().nonnegative(),
  version: z.literal(PROJECT_DOC_VERSION),
});
export type ProjectDocMeta = z.infer<typeof ProjectDocMetaSchema>;

export const PROJECT_DOC_TABLES = [
  "chapters",
  "characters",
  "characterRels",
  "locations",
  "worldbuilding",
  "timeline",
  "styleGuide",
  "outlineColumns",
  "outlineRows",
  "outlineCells",
] as const;
export type ProjectDocTable = (typeof PROJECT_DOC_TABLES)[number];

export const PROJECT_DOC_TABLE_SCHEMAS = {
  chapters: ChapterSchema,
  characters: CharacterSchema,
  characterRels: CharacterRelationshipSchema,
  locations: LocationSchema,
  worldbuilding: WorldbuildingDocSchema,
  timeline: TimelineEventSchema,
  styleGuide: StyleGuideEntrySchema,
  outlineColumns: OutlineGridColumnSchema,
  outlineRows: OutlineGridRowSchema,
  outlineCells: OutlineGridCellSchema,
} as const satisfies Record<ProjectDocTable, z.ZodTypeAny>;

export type ProjectDocEntity<T extends ProjectDocTable> = z.infer<
  (typeof PROJECT_DOC_TABLE_SCHEMAS)[T]
>;

const META_KEY = "meta";
const PROJECT_KEY = "project";
const PROJECT_ROW_FIELD = "json";

export function getProjectMeta(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap<unknown>(META_KEY);
}

export function getProjectRow(doc: Y.Doc): Y.Map<string> {
  return doc.getMap<string>(PROJECT_KEY);
}

export function getProjectTable(
  doc: Y.Doc,
  table: ProjectDocTable,
): Y.Map<string> {
  return doc.getMap<string>(table);
}

export function readProjectMeta(doc: Y.Doc): ProjectDocMeta | null {
  const m = getProjectMeta(doc);
  if (m.size === 0) return null;
  const candidate = {
    mode: m.get("mode"),
    projectId: m.get("projectId"),
    activeChapterId: m.get("activeChapterId") ?? null,
    revision: m.get("revision"),
    version: m.get("version"),
  };
  const parsed = ProjectDocMetaSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function writeProjectMeta(
  doc: Y.Doc,
  patch: Partial<ProjectDocMeta>,
  origin: unknown,
): void {
  const m = getProjectMeta(doc);
  doc.transact(() => {
    for (const [k, v] of Object.entries(patch)) {
      m.set(k, v as unknown);
    }
  }, origin);
}

export function readProjectRow(doc: Y.Doc): Project | null {
  const row = getProjectRow(doc);
  const json = row.get(PROJECT_ROW_FIELD);
  if (typeof json !== "string") return null;
  return safeParseJson(json, ProjectSchema);
}

export function writeProjectRow(
  doc: Y.Doc,
  row: Project | null,
  origin: unknown,
): void {
  const m = getProjectRow(doc);
  doc.transact(() => {
    if (row === null) m.delete(PROJECT_ROW_FIELD);
    else m.set(PROJECT_ROW_FIELD, JSON.stringify(row));
  }, origin);
}

export function upsertEntity<T extends ProjectDocTable>(
  doc: Y.Doc,
  table: T,
  row: ProjectDocEntity<T>,
  origin: unknown,
): void {
  const map = getProjectTable(doc, table);
  const id = (row as { id: string }).id;
  doc.transact(() => {
    map.set(id, JSON.stringify(row));
  }, origin);
}

export function deleteEntity(
  doc: Y.Doc,
  table: ProjectDocTable,
  id: string,
  origin: unknown,
): void {
  const map = getProjectTable(doc, table);
  doc.transact(() => {
    map.delete(id);
  }, origin);
}

export function readEntity<T extends ProjectDocTable>(
  doc: Y.Doc,
  table: T,
  id: string,
): ProjectDocEntity<T> | null {
  const map = getProjectTable(doc, table);
  const json = map.get(id);
  if (typeof json !== "string") return null;
  return safeParseJson(
    json,
    PROJECT_DOC_TABLE_SCHEMAS[table],
  ) as ProjectDocEntity<T> | null;
}

export function readEntities<T extends ProjectDocTable>(
  doc: Y.Doc,
  table: T,
): ProjectDocEntity<T>[] {
  const map = getProjectTable(doc, table);
  const out: ProjectDocEntity<T>[] = [];
  const schema = PROJECT_DOC_TABLE_SCHEMAS[table];
  for (const json of map.values()) {
    if (typeof json !== "string") continue;
    const parsed = safeParseJson(json, schema);
    if (parsed) out.push(parsed as ProjectDocEntity<T>);
  }
  return out;
}

function safeParseJson<S extends z.ZodTypeAny>(
  json: string,
  schema: S,
): z.infer<S> | null {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(json);
  } catch {
    return null;
  }
  const result = schema.safeParse(parsedJson);
  return result.success ? (result.data as z.infer<S>) : null;
}
