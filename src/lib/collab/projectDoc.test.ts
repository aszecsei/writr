import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import type {
  Chapter,
  ChapterId,
  Character,
  CharacterId,
  OutlineGridCell,
  OutlineGridCellId,
  OutlineGridColumnId,
  OutlineGridRowId,
  Project,
  ProjectId,
} from "@/db/schemas";
import {
  deleteEntity,
  getProjectMeta,
  getProjectRow,
  getProjectTable,
  PROJECT_DOC_TABLES,
  PROJECT_DOC_VERSION,
  readEntities,
  readEntity,
  readProjectMeta,
  readProjectRow,
  upsertEntity,
  writeProjectMeta,
  writeProjectRow,
} from "./projectDoc";

const PROJECT_ID = "00000000-0000-4000-8000-0000000000aa" as ProjectId;
const CHAPTER_ID_1 = "00000000-0000-4000-8000-000000000001" as ChapterId;
const CHAPTER_ID_2 = "00000000-0000-4000-8000-000000000002" as ChapterId;
const CHARACTER_ID_1 = "00000000-0000-4000-8000-000000000011" as CharacterId;
const ROW_ID = "00000000-0000-4000-8000-0000000000bb" as OutlineGridRowId;
const COL_ID = "00000000-0000-4000-8000-0000000000cc" as OutlineGridColumnId;
const CELL_ID = "00000000-0000-4000-8000-0000000000dd" as OutlineGridCellId;

const NOW = "2026-05-06T12:00:00.000Z";

const HOST_ORIGIN = Symbol("host");

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    title: "My Project",
    description: "",
    genre: "",
    targetWordCount: 0,
    mode: "prose",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeChapter(id: ChapterId, overrides: Partial<Chapter> = {}): Chapter {
  return {
    id,
    projectId: PROJECT_ID,
    title: `Chapter ${id.slice(-1)}`,
    order: 0,
    content: "Chapter body.",
    synopsis: "",
    status: "draft",
    wordCount: 2,
    parentChapterId: null,
    section: "manuscript",
    kind: "document",
    includeInCompile: true,
    pageBreakBefore: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeCharacter(
  id: CharacterId,
  overrides: Partial<Character> = {},
): Character {
  return {
    id,
    projectId: PROJECT_ID,
    name: "Alice",
    role: "protagonist",
    pronouns: "she/her",
    aliases: ["Al"],
    summary: "",
    description: "",
    personality: "",
    motivations: "",
    internalConflict: "",
    strengths: "",
    weaknesses: "",
    characterArcs: "",
    dialogueStyle: "",
    backstory: "",
    notes: "",
    linkedCharacterIds: [],
    linkedLocationIds: [],
    images: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("projectDoc tables enum", () => {
  it("covers all project-share entity tables", () => {
    expect(PROJECT_DOC_TABLES).toEqual([
      "chapters",
      "characters",
      "characterRels",
      "locations",
      "worldbuilding",
      "timeline",
      "styleGuide",
      "guardrails",
      "outlineColumns",
      "outlineRows",
      "outlineCells",
    ]);
  });
});

describe("project meta", () => {
  it("returns null when no meta has been written", () => {
    const doc = new Y.Doc();
    expect(readProjectMeta(doc)).toBeNull();
  });

  it("round-trips a full meta object", () => {
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
  });

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

  it("emits a Y observe event on each meta change", () => {
    const doc = new Y.Doc();
    const events: string[][] = [];
    getProjectMeta(doc).observe((e) => {
      events.push(Array.from(e.keysChanged));
    });
    writeProjectMeta(
      doc,
      {
        mode: "project",
        projectId: PROJECT_ID,
        activeChapterId: null,
        revision: 0,
        version: PROJECT_DOC_VERSION,
      },
      HOST_ORIGIN,
    );
    writeProjectMeta(doc, { activeChapterId: CHAPTER_ID_1 }, HOST_ORIGIN);
    expect(events.length).toBe(2);
    expect(events[1]).toEqual(["activeChapterId"]);
  });
});

describe("project row", () => {
  it("returns null when no row has been written", () => {
    const doc = new Y.Doc();
    expect(readProjectRow(doc)).toBeNull();
  });

  it("round-trips the project row", () => {
    const doc = new Y.Doc();
    const project = makeProject({ title: "Round-trip" });
    writeProjectRow(doc, project, HOST_ORIGIN);
    expect(readProjectRow(doc)).toEqual(project);
  });

  it("clears the project row when null is written", () => {
    const doc = new Y.Doc();
    writeProjectRow(doc, makeProject(), HOST_ORIGIN);
    writeProjectRow(doc, null, HOST_ORIGIN);
    expect(readProjectRow(doc)).toBeNull();
    expect(getProjectRow(doc).has("json")).toBe(false);
  });
});

describe("entity upsert / read / delete", () => {
  it("round-trips a chapter through the chapters table", () => {
    const doc = new Y.Doc();
    const chapter = makeChapter(CHAPTER_ID_1);
    upsertEntity(doc, "chapters", chapter, HOST_ORIGIN);
    expect(readEntity(doc, "chapters", CHAPTER_ID_1)).toEqual(chapter);
  });

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

  it("upserts overwrite the previous row by id", () => {
    const doc = new Y.Doc();
    upsertEntity(doc, "chapters", makeChapter(CHAPTER_ID_1), HOST_ORIGIN);
    upsertEntity(
      doc,
      "chapters",
      makeChapter(CHAPTER_ID_1, { title: "Renamed" }),
      HOST_ORIGIN,
    );
    expect(readEntity(doc, "chapters", CHAPTER_ID_1)?.title).toBe("Renamed");
    expect(getProjectTable(doc, "chapters").size).toBe(1);
  });

  it("deletes remove the row from the table", () => {
    const doc = new Y.Doc();
    upsertEntity(doc, "chapters", makeChapter(CHAPTER_ID_1), HOST_ORIGIN);
    upsertEntity(doc, "chapters", makeChapter(CHAPTER_ID_2), HOST_ORIGIN);
    deleteEntity(doc, "chapters", CHAPTER_ID_1, HOST_ORIGIN);
    expect(readEntity(doc, "chapters", CHAPTER_ID_1)).toBeNull();
    expect(readEntities(doc, "chapters")).toHaveLength(1);
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

describe("two-doc convergence via Y.applyUpdate", () => {
  it("guest sees host upserts after applying the encoded update", () => {
    const host = new Y.Doc();
    const guest = new Y.Doc();

    upsertEntity(host, "chapters", makeChapter(CHAPTER_ID_1), HOST_ORIGIN);
    upsertEntity(
      host,
      "characters",
      makeCharacter(CHARACTER_ID_1),
      HOST_ORIGIN,
    );
    writeProjectMeta(
      host,
      {
        mode: "project",
        projectId: PROJECT_ID,
        activeChapterId: CHAPTER_ID_1,
        revision: 1,
        version: PROJECT_DOC_VERSION,
      },
      HOST_ORIGIN,
    );
    writeProjectRow(host, makeProject(), HOST_ORIGIN);

    Y.applyUpdate(guest, Y.encodeStateAsUpdate(host));

    expect(readEntities(guest, "chapters")).toHaveLength(1);
    expect(readEntity(guest, "characters", CHARACTER_ID_1)?.name).toBe("Alice");
    expect(readProjectRow(guest)?.title).toBe("My Project");
    expect(readProjectMeta(guest)?.activeChapterId).toBe(CHAPTER_ID_1);
  });

  it("guest reflects deletes propagated from host", () => {
    const host = new Y.Doc();
    const guest = new Y.Doc();

    upsertEntity(host, "chapters", makeChapter(CHAPTER_ID_1), HOST_ORIGIN);
    Y.applyUpdate(guest, Y.encodeStateAsUpdate(host));
    expect(readEntities(guest, "chapters")).toHaveLength(1);

    deleteEntity(host, "chapters", CHAPTER_ID_1, HOST_ORIGIN);
    Y.applyUpdate(guest, Y.encodeStateAsUpdate(host));
    expect(readEntities(guest, "chapters")).toHaveLength(0);
  });
});
