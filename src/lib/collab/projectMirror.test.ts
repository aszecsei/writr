import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import type {
  Chapter,
  Character,
  CharacterRelationship,
  Location,
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow,
  Project,
  StyleGuideEntry,
  TimelineEvent,
  WorldbuildingDoc,
} from "@/db/schemas";
import {
  PROJECT_DOC_VERSION,
  readEntities,
  readEntity,
  readProjectMeta,
  readProjectRow,
} from "./projectDoc";
import {
  MIRROR_ORIGIN,
  ProjectMirror,
  type ProjectSnapshot,
} from "./projectMirror";

const PROJECT_ID = "00000000-0000-4000-8000-0000000000aa";
const CHAPTER_ID_1 = "00000000-0000-4000-8000-000000000001";
const CHAPTER_ID_2 = "00000000-0000-4000-8000-000000000002";
const CHARACTER_ID_1 = "00000000-0000-4000-8000-000000000011";
const NOW = "2026-05-06T12:00:00.000Z";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    title: "Project",
    description: "",
    genre: "",
    targetWordCount: 0,
    mode: "prose",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function chapter(id: string, overrides: Partial<Chapter> = {}): Chapter {
  return {
    id,
    projectId: PROJECT_ID,
    title: `Ch ${id.slice(-1)}`,
    order: 0,
    content: "",
    synopsis: "",
    status: "draft",
    wordCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function character(id: string, overrides: Partial<Character> = {}): Character {
  return {
    id,
    projectId: PROJECT_ID,
    name: "Alice",
    role: "protagonist",
    pronouns: "",
    aliases: [],
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

function emptySnapshot(): ProjectSnapshot {
  return {
    project: project(),
    activeChapterId: null,
    chapters: [],
    characters: [],
    characterRels: [] as CharacterRelationship[],
    locations: [] as Location[],
    worldbuilding: [] as WorldbuildingDoc[],
    timeline: [] as TimelineEvent[],
    styleGuide: [] as StyleGuideEntry[],
    outlineColumns: [] as OutlineGridColumn[],
    outlineRows: [] as OutlineGridRow[],
    outlineCells: [] as OutlineGridCell[],
  };
}

describe("ProjectMirror.seedFromSnapshot", () => {
  it("populates all tables, project, and meta atomically", () => {
    const doc = new Y.Doc();
    const mirror = new ProjectMirror({ doc, projectId: PROJECT_ID });
    const snapshot: ProjectSnapshot = {
      ...emptySnapshot(),
      activeChapterId: CHAPTER_ID_1,
      chapters: [chapter(CHAPTER_ID_1), chapter(CHAPTER_ID_2)],
      characters: [character(CHARACTER_ID_1)],
    };

    mirror.seedFromSnapshot(snapshot);

    expect(readProjectRow(doc)?.id).toBe(PROJECT_ID);
    expect(readEntities(doc, "chapters")).toHaveLength(2);
    expect(readEntity(doc, "characters", CHARACTER_ID_1)?.name).toBe("Alice");
    const meta = readProjectMeta(doc);
    expect(meta).toEqual({
      mode: "project",
      projectId: PROJECT_ID,
      activeChapterId: CHAPTER_ID_1,
      revision: 1,
      version: PROJECT_DOC_VERSION,
    });
  });

  it("emits exactly one update for a full seed", () => {
    const doc = new Y.Doc();
    const mirror = new ProjectMirror({ doc, projectId: PROJECT_ID });
    const updates: number = countUpdatesDuring(doc, () => {
      mirror.seedFromSnapshot({
        ...emptySnapshot(),
        chapters: [chapter(CHAPTER_ID_1)],
      });
    });
    expect(updates).toBe(1);
  });

  it("removes rows that are absent from the new snapshot", () => {
    const doc = new Y.Doc();
    const mirror = new ProjectMirror({ doc, projectId: PROJECT_ID });
    mirror.seedFromSnapshot({
      ...emptySnapshot(),
      chapters: [chapter(CHAPTER_ID_1), chapter(CHAPTER_ID_2)],
    });
    mirror.seedFromSnapshot({
      ...emptySnapshot(),
      chapters: [chapter(CHAPTER_ID_2)],
    });
    expect(readEntity(doc, "chapters", CHAPTER_ID_1)).toBeNull();
    expect(readEntity(doc, "chapters", CHAPTER_ID_2)).not.toBeNull();
  });
});

describe("ProjectMirror.syncTable", () => {
  it("emits no updates when rows are unchanged", () => {
    const doc = new Y.Doc();
    const mirror = new ProjectMirror({ doc, projectId: PROJECT_ID });
    const rows = [chapter(CHAPTER_ID_1)];
    mirror.syncTable("chapters", rows);
    const updates = countUpdatesDuring(doc, () => {
      mirror.syncTable("chapters", [chapter(CHAPTER_ID_1)]);
    });
    expect(updates).toBe(0);
  });

  it("upserts only changed rows, not the entire table", () => {
    const doc = new Y.Doc();
    const mirror = new ProjectMirror({ doc, projectId: PROJECT_ID });
    mirror.syncTable("chapters", [
      chapter(CHAPTER_ID_1),
      chapter(CHAPTER_ID_2),
    ]);

    const observed: Array<{ added: string[]; deleted: string[] }> = [];
    doc.getMap<string>("chapters").observe((event) => {
      observed.push({
        added: [...event.changes.keys.entries()]
          .filter(
            ([, info]) => info.action === "add" || info.action === "update",
          )
          .map(([k]) => k),
        deleted: [...event.changes.keys.entries()]
          .filter(([, info]) => info.action === "delete")
          .map(([k]) => k),
      });
    });

    mirror.syncTable("chapters", [
      chapter(CHAPTER_ID_1, { title: "Renamed" }),
      chapter(CHAPTER_ID_2),
    ]);
    expect(observed).toHaveLength(1);
    expect(observed[0]?.added).toEqual([CHAPTER_ID_1]);
    expect(observed[0]?.deleted).toEqual([]);
  });

  it("deletes rows missing from the new set", () => {
    const doc = new Y.Doc();
    const mirror = new ProjectMirror({ doc, projectId: PROJECT_ID });
    mirror.syncTable("chapters", [
      chapter(CHAPTER_ID_1),
      chapter(CHAPTER_ID_2),
    ]);
    mirror.syncTable("chapters", [chapter(CHAPTER_ID_2)]);
    expect(readEntity(doc, "chapters", CHAPTER_ID_1)).toBeNull();
    expect(readEntity(doc, "chapters", CHAPTER_ID_2)).not.toBeNull();
  });

  it("uses the MIRROR_ORIGIN on writes so consumers can filter their own", () => {
    const doc = new Y.Doc();
    const mirror = new ProjectMirror({ doc, projectId: PROJECT_ID });
    const seenOrigins: unknown[] = [];
    doc.on("update", (_update, origin) => seenOrigins.push(origin));
    mirror.syncTable("chapters", [chapter(CHAPTER_ID_1)]);
    expect(seenOrigins).toContain(MIRROR_ORIGIN);
  });
});

describe("ProjectMirror.setActiveChapterId / bumpRevision", () => {
  it("writes activeChapterId to meta without disturbing other keys", () => {
    const doc = new Y.Doc();
    const mirror = new ProjectMirror({ doc, projectId: PROJECT_ID });
    mirror.seedFromSnapshot({
      ...emptySnapshot(),
      activeChapterId: CHAPTER_ID_1,
    });
    mirror.setActiveChapterId(CHAPTER_ID_2);
    const meta = readProjectMeta(doc);
    expect(meta?.activeChapterId).toBe(CHAPTER_ID_2);
    expect(meta?.projectId).toBe(PROJECT_ID);
  });

  it("bumpRevision increments the meta revision", () => {
    const doc = new Y.Doc();
    const mirror = new ProjectMirror({ doc, projectId: PROJECT_ID });
    mirror.seedFromSnapshot(emptySnapshot());
    mirror.bumpRevision();
    expect(readProjectMeta(doc)?.revision).toBe(2);
  });
});

describe("ProjectMirror.destroy", () => {
  it("becomes a no-op on subsequent calls", () => {
    const doc = new Y.Doc();
    const mirror = new ProjectMirror({ doc, projectId: PROJECT_ID });
    mirror.destroy();
    const updates = countUpdatesDuring(doc, () => {
      mirror.syncTable("chapters", [chapter(CHAPTER_ID_1)]);
      mirror.seedFromSnapshot(emptySnapshot());
      mirror.setActiveChapterId(CHAPTER_ID_2);
      mirror.bumpRevision();
    });
    expect(updates).toBe(0);
    expect(mirror.isDestroyed).toBe(true);
  });
});

describe("ProjectMirror.resetHashes", () => {
  it("forces the next syncTable to re-emit even unchanged rows", () => {
    const doc = new Y.Doc();
    const mirror = new ProjectMirror({ doc, projectId: PROJECT_ID });
    mirror.syncTable("chapters", [chapter(CHAPTER_ID_1)]);
    mirror.resetHashes();
    const updates = countUpdatesDuring(doc, () => {
      mirror.syncTable("chapters", [chapter(CHAPTER_ID_1)]);
    });
    expect(updates).toBe(1);
  });
});

function countUpdatesDuring(doc: Y.Doc, fn: () => void): number {
  const handler = vi.fn();
  doc.on("update", handler);
  try {
    fn();
  } finally {
    doc.off("update", handler);
  }
  return handler.mock.calls.length;
}
