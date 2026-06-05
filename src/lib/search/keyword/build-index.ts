import MiniSearch from "minisearch";
import { match } from "ts-pattern";
import { db } from "@/db/database";
import type { ChapterId } from "@/db/schemas";
import { splitParagraphs } from "@/lib/ai/tool-calling/tools/helpers";
import { entityConfigs } from "../entity-config";
import type { SearchableEntityType } from "../types";
import {
  ALL_INDEXED_FIELDS,
  entityToDoc,
  type IndexedDoc,
  makeDocId,
} from "./document";

export interface BuiltIndex {
  index: MiniSearch;
  docs: Map<string, IndexedDoc>;
}

export interface ParagraphDoc {
  docId: string;
  paragraphNumber: number;
  text: string;
}

export interface BuiltParagraphIndex {
  index: MiniSearch;
  docs: Map<string, ParagraphDoc>;
}

const FIELD_BOOSTS: Record<string, number> = {
  // Title-like fields outrank body fields. The numbers are minisearch boosts,
  // not raw scores — relative magnitudes are what matter.
  title: 3,
  name: 3,
};

function makeProjectMiniSearch(): MiniSearch {
  return new MiniSearch({
    fields: ALL_INDEXED_FIELDS,
    storeFields: ["entityId", "entityType"],
    idField: "docId",
    extractField: (doc, fieldName) => {
      if (fieldName === "docId") return (doc as IndexedDoc).docId;
      if (fieldName === "entityId") return (doc as IndexedDoc).entityId;
      if (fieldName === "entityType") return (doc as IndexedDoc).entityType;
      return (doc as IndexedDoc).fields[fieldName] ?? "";
    },
    searchOptions: {
      boost: FIELD_BOOSTS,
      prefix: true,
      fuzzy: 0.15,
      combineWith: "OR",
    },
  });
}

function makeParagraphMiniSearch(): MiniSearch {
  return new MiniSearch({
    fields: ["text"],
    storeFields: ["paragraphNumber"],
    idField: "docId",
    searchOptions: {
      prefix: true,
      fuzzy: 0.15,
      combineWith: "OR",
    },
  });
}

async function loadEntityDocs(
  projectId: string,
  entityType: SearchableEntityType,
): Promise<IndexedDoc[]> {
  return match(entityType)
    .with("chapter", async (t) => {
      const chapters = await db.chapters.where({ projectId }).toArray();
      return chapters.map((c) =>
        entityToDoc({
          entity: c as unknown as Record<string, unknown> & { id: string },
          entityType: t,
          projectId,
          titleField: "title",
        }),
      );
    })
    .with("character", async (t) => {
      const characters = await db.characters.where({ projectId }).toArray();
      return characters.map((c) =>
        entityToDoc({
          entity: c as unknown as Record<string, unknown> & { id: string },
          entityType: t,
          projectId,
          titleField: "name",
          subtitleField: "role",
        }),
      );
    })
    .with("location", async (t) => {
      const locations = await db.locations.where({ projectId }).toArray();
      return locations.map((l) =>
        entityToDoc({
          entity: l as unknown as Record<string, unknown> & { id: string },
          entityType: t,
          projectId,
          titleField: "name",
        }),
      );
    })
    .with("timelineEvent", async (t) => {
      const events = await db.timelineEvents.where({ projectId }).toArray();
      return events.map((e) =>
        entityToDoc({
          entity: e as unknown as Record<string, unknown> & { id: string },
          entityType: t,
          projectId,
          titleField: "title",
        }),
      );
    })
    .with("styleGuideEntry", async (t) => {
      const entries = await db.styleGuideEntries.where({ projectId }).toArray();
      return entries.map((e) =>
        entityToDoc({
          entity: e as unknown as Record<string, unknown> & { id: string },
          entityType: t,
          projectId,
          titleField: "title",
          subtitleField: "category",
        }),
      );
    })
    .with("worldbuildingDoc", async (t) => {
      const docs = await db.worldbuildingDocs.where({ projectId }).toArray();
      return docs.map((d) =>
        entityToDoc({
          entity: d as unknown as Record<string, unknown> & { id: string },
          entityType: t,
          projectId,
          titleField: "title",
        }),
      );
    })
    .with("outlineCell", async () => {
      // Outline cells have no native title — display title is composed from
      // the parent row label and column title, requiring joins.
      const [cells, rows, columns] = await Promise.all([
        db.outlineGridCells.where({ projectId }).toArray(),
        db.outlineGridRows.where({ projectId }).sortBy("order"),
        db.outlineGridColumns.where({ projectId }).toArray(),
      ]);
      const rowMap = new Map(rows.map((r) => [r.id, r]));
      const rowIndexMap = new Map(rows.map((r, i) => [r.id, i]));
      const columnMap = new Map(columns.map((c) => [c.id, c]));
      const out: IndexedDoc[] = [];
      for (const cell of cells) {
        const row = rowMap.get(cell.rowId);
        const column = columnMap.get(cell.columnId);
        if (!row || !column) continue;
        const rowLabel =
          row.label || `Row ${(rowIndexMap.get(row.id) ?? 0) + 1}`;
        out.push({
          docId: makeDocId("outlineCell", cell.id),
          entityId: cell.id,
          entityType: "outlineCell",
          displayTitle: `${rowLabel} - ${column.title}`,
          subtitle: column.title,
          url: entityConfigs.outlineCell.buildUrl(projectId, cell.id),
          fields: cell.content ? { content: cell.content } : {},
        });
      }
      return out;
    })
    .exhaustive();
}

export async function buildProjectIndex(
  projectId: string,
  entityTypes?: SearchableEntityType[],
): Promise<BuiltIndex> {
  const types =
    entityTypes && entityTypes.length > 0
      ? entityTypes
      : (Object.keys(entityConfigs) as SearchableEntityType[]);

  const perTypeDocs = await Promise.all(
    types.map((t) => loadEntityDocs(projectId, t)),
  );
  const allDocs = perTypeDocs.flat();

  const index = makeProjectMiniSearch();
  index.addAll(allDocs);
  const docMap = new Map(allDocs.map((d) => [d.docId, d]));
  return { index, docs: docMap };
}

export async function buildChaptersIndex(
  projectId: string,
  readableChapterIds?: ReadonlySet<string>,
): Promise<BuiltIndex> {
  let chapters = await db.chapters.where({ projectId }).toArray();
  // Separators are structural markers, not searchable documents.
  chapters = chapters.filter((c) => c.kind !== "separator");
  if (readableChapterIds) {
    chapters = chapters.filter((c) => readableChapterIds.has(c.id));
  }
  const docs = chapters.map((c) =>
    entityToDoc({
      entity: c as unknown as Record<string, unknown> & { id: string },
      entityType: "chapter",
      projectId,
      titleField: "title",
    }),
  );
  const index = makeProjectMiniSearch();
  index.addAll(docs);
  const docMap = new Map(docs.map((d) => [d.docId, d]));
  return { index, docs: docMap };
}

export async function buildChapterParagraphIndex(chapterId: ChapterId): Promise<
  { chapter: { id: string; title: string; content: string } | null } & {
    built: BuiltParagraphIndex | null;
  }
> {
  const chapter = await db.chapters.get(chapterId);
  if (!chapter) return { chapter: null, built: null };

  const paragraphs = splitParagraphs(chapter.content);
  const docs: ParagraphDoc[] = paragraphs.map((text, i) => ({
    docId: `p:${i + 1}`,
    paragraphNumber: i + 1,
    text,
  }));
  const index = makeParagraphMiniSearch();
  index.addAll(docs);
  const docMap = new Map(docs.map((d) => [d.docId, d]));
  return {
    chapter: { id: chapter.id, title: chapter.title, content: chapter.content },
    built: { index, docs: docMap },
  };
}
