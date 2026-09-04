import { beforeEach, describe, expect, it } from "vitest";
import { resetIdCounter } from "@/test/helpers";
import { db } from "../database";
import type { ProjectId } from "../schemas";
import { createAgent } from "./agents";
import { upsertChapterSummary } from "./chapterSummaries";
import { createChapter } from "./chapters";
import { createCharacter, createRelationship } from "./characters";
import { createComment } from "./comments";
import { getOrCreateProjectDictionary } from "./dictionary";
import { createGuardrailEntry } from "./guardrails";
import { putIndexedChunk } from "./indexedChunks";
import { createLocation } from "./locations";
import {
  createOutlineGridColumn,
  createOutlineGridRow,
  upsertOutlineGridCell,
} from "./outline";
import { createPlaylistTrack } from "./playlist";
import { createProject, deleteProject } from "./projects";
import { createSnapshot } from "./snapshots";
import { createSprint, endSprint, recordWritingSession } from "./sprints";
import { createStyleGuideEntry } from "./style-guide";
import { createTimelineEvent } from "./timeline";
import { createWorldbuildingDoc } from "./worldbuilding";

// Every table `deleteProject` cascades through, keyed by its Dexie table name.
// Cross-checked below against every table actually indexed by `projectId`, so
// a new project-scoped table shows up here as a failing assertion rather than
// a silent cascade gap.
const CASCADED_TABLES = [
  "chapters",
  "characters",
  "locations",
  "timelineEvents",
  "styleGuideEntries",
  "worldbuildingDocs",
  "characterRelationships",
  "outlineGridColumns",
  "outlineGridRows",
  "outlineGridCells",
  "writingSprints",
  "writingSessions",
  "playlistTracks",
  "comments",
  "chapterSnapshots",
  "projectDictionaries",
  "chapterSummaries",
  "agents",
  "indexedChunks",
  "guardrailEntries",
  "scenes",
].sort();

// Tables Dexie still indexes by projectId that `deleteProject` deliberately
// leaves alone: savedPrompts carries a nullable projectId (global-or-scoped)
// but prompts survive deletion of the project that scoped them; outlineColumns
// and outlineCards are pre-v9 stores superseded by outlineGrid* — no code path
// writes to them any more, but the Dexie version chain never dropped the
// object stores, so they still surface here.
const PROJECT_SCOPED_BUT_NOT_CASCADED = [
  "savedPrompts",
  "outlineColumns",
  "outlineCards",
];

async function seedEveryProjectScopedTable(projectId: ProjectId) {
  const chapter = await createChapter({ projectId, title: "Ch1" }); // also seeds a scene
  const charA = await createCharacter({ projectId, name: "A" });
  const charB = await createCharacter({ projectId, name: "B" });
  await createLocation({ projectId, name: "Town" });
  await createTimelineEvent({ projectId, title: "Event" });
  await createStyleGuideEntry({ projectId, title: "Rule" });
  await createWorldbuildingDoc({ projectId, title: "Lore" });
  await createRelationship({
    projectId,
    sourceCharacterId: charA.id,
    targetCharacterId: charB.id,
    type: "sibling",
  });
  const column = await createOutlineGridColumn({ projectId, title: "Ideas" });
  const row = await createOutlineGridRow({ projectId, label: "Row 1" });
  await upsertOutlineGridCell({
    projectId,
    rowId: row.id,
    columnId: column.id,
  });
  const sprint = await createSprint({
    durationMs: 1500000,
    startWordCount: 0,
    projectId,
  });
  await endSprint(sprint.id, 100);
  await recordWritingSession(projectId, chapter.id, 0, 100);
  await createPlaylistTrack({
    projectId,
    title: "Track",
    url: "https://example.com/track",
    source: "youtube",
  });
  await createComment({
    projectId,
    chapterId: chapter.id,
    fromOffset: 0,
    toOffset: 10,
  });
  await createSnapshot({
    projectId,
    chapterId: chapter.id,
    name: "v1",
    content: "hello",
    wordCount: 1,
  });
  await getOrCreateProjectDictionary(projectId);
  await upsertChapterSummary({
    projectId,
    chapterId: chapter.id,
    sourceContentHash: "hash",
    summary: "summary",
  });
  await createAgent({
    kind: "user",
    projectId,
    name: "Agent",
    systemPrompt: "prompt",
  });
  await putIndexedChunk({
    projectId,
    sourceType: "chapter",
    sourceId: chapter.id,
    chunkIndex: 0,
    text: "t0",
    contentHash: "h0",
    vector: [0.1, 0.2],
    embeddingModel: "fake-v1",
  });
  await createGuardrailEntry({ projectId, label: "No clichés" });
}

async function countForProject(table: string, projectId: ProjectId) {
  return db.table(table).where({ projectId }).count();
}

describe("project-scoped table inventory", () => {
  it("matches every table Dexie indexes by projectId, minus explicit exemptions", () => {
    const indexedByProjectId = db.tables
      .filter((t) => t.schema.indexes.some((idx) => idx.name === "projectId"))
      .map((t) => t.name)
      .filter((name) => !PROJECT_SCOPED_BUT_NOT_CASCADED.includes(name))
      .sort();
    expect(indexedByProjectId).toEqual(CASCADED_TABLES);
  });
});

describe("deleteProject (cascading delete)", () => {
  beforeEach(async () => {
    resetIdCounter();
  });

  it("empties every project-scoped table for the deleted project, and only that project", async () => {
    const target = await createProject({ title: "Doomed" });
    const other = await createProject({ title: "Safe" });
    await seedEveryProjectScopedTable(target.id);
    await seedEveryProjectScopedTable(other.id);

    await deleteProject(target.id);

    for (const table of CASCADED_TABLES) {
      expect(await countForProject(table, target.id)).toBe(0);
      expect(await countForProject(table, other.id)).toBeGreaterThan(0);
    }
    expect(await db.projects.get(target.id)).toBeUndefined();
    expect(await db.projects.get(other.id)).toBeDefined();
  });
});
