import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import type {
  ChapterId,
  CharacterId,
  OutlineGridCell,
  OutlineGridCellId,
  OutlineGridColumnId,
  OutlineGridRowId,
} from "@/db/schemas";
import {
  getProjectMeta,
  getProjectRow,
  getProjectTable,
  PROJECT_DOC_VERSION,
  readEntities,
  readEntity,
  readProjectMeta,
  readProjectRow,
  upsertEntity,
  writeProjectMeta,
  writeProjectRow,
} from "./projectDoc";
import {
  chapter as makeChapter,
  character as makeCharacter,
  project as makeProject,
  PROJECT_ID,
} from "./test-support";

const CHAPTER_ID_1 = "00000000-0000-4000-8000-000000000001" as ChapterId;
const CHAPTER_ID_2 = "00000000-0000-4000-8000-000000000002" as ChapterId;
const CHARACTER_ID_1 = "00000000-0000-4000-8000-000000000011" as CharacterId;
const ROW_ID = "00000000-0000-4000-8000-0000000000bb" as OutlineGridRowId;
const COL_ID = "00000000-0000-4000-8000-0000000000cc" as OutlineGridColumnId;
const CELL_ID = "00000000-0000-4000-8000-0000000000dd" as OutlineGridCellId;

const NOW = "2026-05-06T12:00:00.000Z";

const HOST_ORIGIN = Symbol("host");

describe("round-trips", () => {
  it("meta, project row, and a chapter entity survive a write/read cycle", () => {
    const doc = new Y.Doc();

    writeProjectMeta(
      doc,
      {
        mode: "project",
        projectId: PROJECT_ID,
        activeChapterId: CHAPTER_ID_1,
        revision: 1,
        version: PROJECT_DOC_VERSION,
      },
      HOST_ORIGIN,
    );
    expect(readProjectMeta(doc)).toEqual({
      mode: "project",
      projectId: PROJECT_ID,
      activeChapterId: CHAPTER_ID_1,
      revision: 1,
      version: PROJECT_DOC_VERSION,
    });

    const project = makeProject({ title: "Round-trip" });
    writeProjectRow(doc, project, HOST_ORIGIN);
    expect(readProjectRow(doc)).toEqual(project);

    const chapter = makeChapter(CHAPTER_ID_1);
    upsertEntity(doc, "chapters", chapter, HOST_ORIGIN);
    expect(readEntity(doc, "chapters", CHAPTER_ID_1)).toEqual(chapter);
  });
});

describe("project meta", () => {
  it("applies a patch without touching unrelated keys", () => {
    const doc = new Y.Doc();
    writeProjectMeta(
      doc,
      {
        mode: "project",
        projectId: PROJECT_ID,
        activeChapterId: CHAPTER_ID_1,
        revision: 1,
        version: PROJECT_DOC_VERSION,
      },
      HOST_ORIGIN,
    );
    writeProjectMeta(doc, { activeChapterId: CHAPTER_ID_2 }, HOST_ORIGIN);
    const meta = readProjectMeta(doc);
    expect(meta?.activeChapterId).toBe(CHAPTER_ID_2);
    expect(meta?.projectId).toBe(PROJECT_ID);
    expect(meta?.revision).toBe(1);
  });

  it("returns null when meta is malformed", () => {
    const doc = new Y.Doc();
    const m = getProjectMeta(doc);
    m.set("mode", "chapter"); // wrong literal
    expect(readProjectMeta(doc)).toBeNull();
  });
});

describe("project row", () => {
  it("clears the project row when null is written", () => {
    const doc = new Y.Doc();
    writeProjectRow(doc, makeProject(), HOST_ORIGIN);
    writeProjectRow(doc, null, HOST_ORIGIN);
    expect(readProjectRow(doc)).toBeNull();
    expect(getProjectRow(doc).has("json")).toBe(false);
  });
});

describe("entity upsert / read / delete", () => {
  it("preserves arrays inside character rows (no nested-Y truncation)", () => {
    const doc = new Y.Doc();
    const char = makeCharacter(CHARACTER_ID_1, {
      aliases: ["Al", "Allie"],
      linkedCharacterIds: [CHARACTER_ID_1],
      images: [
        {
          id: "00000000-0000-4000-8000-000000000099" as never,
          url: "https://example.com/x.png",
          caption: "headshot",
          isPrimary: true,
          focalX: 0.5,
          focalY: 0,
        },
      ],
    });
    upsertEntity(doc, "characters", char, HOST_ORIGIN);
    expect(readEntity(doc, "characters", CHARACTER_ID_1)).toEqual(char);
  });

  it("readEntity returns null for missing or malformed rows", () => {
    const doc = new Y.Doc();
    expect(readEntity(doc, "chapters", CHAPTER_ID_1)).toBeNull();
    getProjectTable(doc, "chapters").set(CHAPTER_ID_1, "not json{");
    expect(readEntity(doc, "chapters", CHAPTER_ID_1)).toBeNull();
  });

  it("readEntities skips malformed rows but keeps valid ones", () => {
    const doc = new Y.Doc();
    upsertEntity(doc, "chapters", makeChapter(CHAPTER_ID_1), HOST_ORIGIN);
    getProjectTable(doc, "chapters").set("bad-id", "{}");
    const rows = readEntities(doc, "chapters");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(CHAPTER_ID_1);
  });

  it("supports outline cells with rowId/columnId references", () => {
    const doc = new Y.Doc();
    const cell: OutlineGridCell = {
      id: CELL_ID,
      projectId: PROJECT_ID,
      rowId: ROW_ID,
      columnId: COL_ID,
      content: "Beat 1",
      color: "blue",
      createdAt: NOW,
      updatedAt: NOW,
    };
    upsertEntity(doc, "outlineCells", cell, HOST_ORIGIN);
    expect(readEntity(doc, "outlineCells", CELL_ID)).toEqual(cell);
  });
});
