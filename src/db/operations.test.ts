import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./database";
import {
  clearSessionCache,
  createChapter,
  createCharacter,
  createComment,
  createLocation,
  createOutlineGridColumn,
  createOutlineGridRow,
  createProject,
  createRelationship,
  createSprint,
  createStyleGuideEntry,
  createTimelineEvent,
  createWorldbuildingDoc,
  deleteComment,
  deleteProject,
  deleteSprint,
  deleteWorldbuildingDoc,
  endSprint,
  getActiveSprint,
  getChaptersByProject,
  getCharactersByProject,
  getComment,
  getCommentsByChapter,
  getLocationsByProject,
  getOutlineGridColumnsByProject,
  getOutlineGridRowsByProject,
  getRelationshipsByProject,
  getSessionsByProject,
  getSprintsByProject,
  getStyleGuideByProject,
  getTimelineByProject,
  getWorldbuildingDoc,
  getWorldbuildingDocsByProject,
  pauseSprint,
  recordWritingSession,
  resolveComment,
  resumeSprint,
  updateChapterContent,
  updateComment,
  updateWorldbuildingDoc,
} from "./operations";
import { toLocalDateString } from "./operations/helpers";

beforeEach(async () => {
  clearSessionCache();
  await db.projects.clear();
  await db.chapters.clear();
  await db.characters.clear();
  await db.locations.clear();
  await db.timelineEvents.clear();
  await db.styleGuideEntries.clear();
  await db.worldbuildingDocs.clear();
  await db.characterRelationships.clear();
  await db.outlineGridColumns.clear();
  await db.outlineGridRows.clear();
  await db.outlineGridCells.clear();
  await db.writingSprints.clear();
  await db.writingSessions.clear();
  await db.comments.clear();
  await db.appSettings.clear();
});

describe("deleteProject (cascading delete)", () => {
  it("deletes project and all child entities", async () => {
    const project = await createProject({ title: "Doomed" });
    await createChapter({ projectId: project.id, title: "Ch1" });
    await createCharacter({ projectId: project.id, name: "Hero" });
    await createLocation({ projectId: project.id, name: "Town" });
    await createTimelineEvent({ projectId: project.id, title: "Event" });
    await createStyleGuideEntry({ projectId: project.id, title: "Rule" });
    await createWorldbuildingDoc({ projectId: project.id, title: "Lore" });
    const char1 = await createCharacter({ projectId: project.id, name: "A" });
    const char2 = await createCharacter({ projectId: project.id, name: "B" });
    await createRelationship({
      projectId: project.id,
      sourceCharacterId: char1.id,
      targetCharacterId: char2.id,
      type: "sibling",
    });
    await createOutlineGridColumn({
      projectId: project.id,
      title: "Ideas",
    });
    await createOutlineGridRow({
      projectId: project.id,
      label: "Row 1",
    });
    const sprint = await createSprint({
      durationMs: 1500000,
      startWordCount: 0,
      projectId: project.id,
    });
    await endSprint(sprint.id, 100);

    await deleteProject(project.id);

    expect(await getChaptersByProject(project.id)).toHaveLength(0);
    expect(await getCharactersByProject(project.id)).toHaveLength(0);
    expect(await getLocationsByProject(project.id)).toHaveLength(0);
    expect(await getTimelineByProject(project.id)).toHaveLength(0);
    expect(await getStyleGuideByProject(project.id)).toHaveLength(0);
    expect(await getWorldbuildingDocsByProject(project.id)).toHaveLength(0);
    expect(await getRelationshipsByProject(project.id)).toHaveLength(0);
    expect(await getOutlineGridColumnsByProject(project.id)).toHaveLength(0);
    expect(await getOutlineGridRowsByProject(project.id)).toHaveLength(0);
    expect(await getSprintsByProject(project.id)).toHaveLength(0);
  });

  it("does not affect other projects", async () => {
    const doomed = await createProject({ title: "Doomed" });
    const safe = await createProject({ title: "Safe" });
    await createChapter({ projectId: doomed.id, title: "Ch1" });
    await createChapter({ projectId: safe.id, title: "Ch2" });

    await deleteProject(doomed.id);

    expect(await getChaptersByProject(safe.id)).toHaveLength(1);
  });
});

describe("updateWorldbuildingDoc (cycle detection)", () => {
  it("throws on direct cycle (parent moved under child)", async () => {
    const project = await createProject({ title: "P" });
    const parent = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Parent",
    });
    const child = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Child",
      parentDocId: parent.id,
    });

    await expect(
      updateWorldbuildingDoc(parent.id, { parentDocId: child.id }),
    ).rejects.toThrow("Cannot move a document under one of its own children.");
  });

  it("throws on indirect cycle (A->B->C, move A under C)", async () => {
    const project = await createProject({ title: "P" });
    const a = await createWorldbuildingDoc({
      projectId: project.id,
      title: "A",
    });
    const b = await createWorldbuildingDoc({
      projectId: project.id,
      title: "B",
      parentDocId: a.id,
    });
    const c = await createWorldbuildingDoc({
      projectId: project.id,
      title: "C",
      parentDocId: b.id,
    });

    await expect(
      updateWorldbuildingDoc(a.id, { parentDocId: c.id }),
    ).rejects.toThrow("Cannot move a document under one of its own children.");
  });

  it("throws on self-reference", async () => {
    const project = await createProject({ title: "P" });
    const doc = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Self",
    });

    await expect(
      updateWorldbuildingDoc(doc.id, { parentDocId: doc.id }),
    ).rejects.toThrow("Cannot move a document under one of its own children.");
  });

  it("allows valid reparenting", async () => {
    const project = await createProject({ title: "P" });
    const a = await createWorldbuildingDoc({
      projectId: project.id,
      title: "A",
    });
    const b = await createWorldbuildingDoc({
      projectId: project.id,
      title: "B",
    });

    await expect(
      updateWorldbuildingDoc(b.id, { parentDocId: a.id }),
    ).resolves.toBeUndefined();
  });

  it("allows moving to root (null parent)", async () => {
    const project = await createProject({ title: "P" });
    const parent = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Parent",
    });
    const child = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Child",
      parentDocId: parent.id,
    });

    await expect(
      updateWorldbuildingDoc(child.id, { parentDocId: null }),
    ).resolves.toBeUndefined();
  });
});

describe("deleteWorldbuildingDoc (re-parenting)", () => {
  it("children adopted by deleted doc's parent", async () => {
    const project = await createProject({ title: "P" });
    const grandparent = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Grandparent",
    });
    const parent = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Parent",
      parentDocId: grandparent.id,
    });
    const child = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Child",
      parentDocId: parent.id,
    });

    await deleteWorldbuildingDoc(parent.id);

    const updated = await getWorldbuildingDoc(child.id);
    expect(updated?.parentDocId).toBe(grandparent.id);
  });

  it("root doc deleted -> children become roots", async () => {
    const project = await createProject({ title: "P" });
    const root = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Root",
    });
    const child = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Child",
      parentDocId: root.id,
    });

    await deleteWorldbuildingDoc(root.id);

    const updated = await getWorldbuildingDoc(child.id);
    expect(updated?.parentDocId).toBeNull();
  });

  it("non-existent doc returns silently", async () => {
    await expect(
      deleteWorldbuildingDoc("00000000-0000-4000-8000-ffffffffffff"),
    ).resolves.toBeUndefined();
  });

  it("leaf doc deletion leaves parent intact", async () => {
    const project = await createProject({ title: "P" });
    const parent = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Parent",
    });
    const leaf = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Leaf",
      parentDocId: parent.id,
    });

    await deleteWorldbuildingDoc(leaf.id);

    const parentDoc = await getWorldbuildingDoc(parent.id);
    expect(parentDoc).toBeDefined();
    expect(parentDoc?.title).toBe("Parent");
  });
});

describe("createRelationship (duplicate & self-ref prevention)", () => {
  it("throws on self-relationship", async () => {
    const project = await createProject({ title: "P" });
    const char = await createCharacter({ projectId: project.id, name: "Solo" });

    await expect(
      createRelationship({
        projectId: project.id,
        sourceCharacterId: char.id,
        targetCharacterId: char.id,
        type: "sibling",
      }),
    ).rejects.toThrow("A character cannot have a relationship with itself.");
  });

  it("throws on exact duplicate (same direction)", async () => {
    const project = await createProject({ title: "P" });
    const a = await createCharacter({ projectId: project.id, name: "A" });
    const b = await createCharacter({ projectId: project.id, name: "B" });

    await createRelationship({
      projectId: project.id,
      sourceCharacterId: a.id,
      targetCharacterId: b.id,
      type: "sibling",
    });

    await expect(
      createRelationship({
        projectId: project.id,
        sourceCharacterId: a.id,
        targetCharacterId: b.id,
        type: "sibling",
      }),
    ).rejects.toThrow("This exact relationship already exists.");
  });

  it("throws on bidirectional duplicate (reversed direction)", async () => {
    const project = await createProject({ title: "P" });
    const a = await createCharacter({ projectId: project.id, name: "A" });
    const b = await createCharacter({ projectId: project.id, name: "B" });

    await createRelationship({
      projectId: project.id,
      sourceCharacterId: a.id,
      targetCharacterId: b.id,
      type: "sibling",
    });

    await expect(
      createRelationship({
        projectId: project.id,
        sourceCharacterId: b.id,
        targetCharacterId: a.id,
        type: "sibling",
      }),
    ).rejects.toThrow("This exact relationship already exists.");
  });

  it("allows same pair with different type", async () => {
    const project = await createProject({ title: "P" });
    const a = await createCharacter({ projectId: project.id, name: "A" });
    const b = await createCharacter({ projectId: project.id, name: "B" });

    await createRelationship({
      projectId: project.id,
      sourceCharacterId: a.id,
      targetCharacterId: b.id,
      type: "sibling",
    });

    await expect(
      createRelationship({
        projectId: project.id,
        sourceCharacterId: a.id,
        targetCharacterId: b.id,
        type: "spouse",
      }),
    ).resolves.toBeDefined();
  });

  it("allows same pair/type with different customLabel", async () => {
    const project = await createProject({ title: "P" });
    const a = await createCharacter({ projectId: project.id, name: "A" });
    const b = await createCharacter({ projectId: project.id, name: "B" });

    await createRelationship({
      projectId: project.id,
      sourceCharacterId: a.id,
      targetCharacterId: b.id,
      type: "custom",
      customLabel: "nemesis",
    });

    await expect(
      createRelationship({
        projectId: project.id,
        sourceCharacterId: a.id,
        targetCharacterId: b.id,
        type: "custom",
        customLabel: "rival",
      }),
    ).resolves.toBeDefined();
  });
});

describe("auto-order", () => {
  it("first entity gets order 0, second gets order 1", async () => {
    const project = await createProject({ title: "P" });
    const ch1 = await createChapter({ projectId: project.id, title: "Ch1" });
    const ch2 = await createChapter({ projectId: project.id, title: "Ch2" });
    expect(ch1.order).toBe(0);
    expect(ch2.order).toBe(1);
  });

  it("explicit order overrides auto-order", async () => {
    const project = await createProject({ title: "P" });
    const ch = await createChapter({
      projectId: project.id,
      title: "Ch",
      order: 42,
    });
    expect(ch.order).toBe(42);
  });

  it("worldbuilding doc order is scoped by parentDocId", async () => {
    const project = await createProject({ title: "P" });
    const root1 = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Root1",
    });
    const root2 = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Root2",
    });
    const child1 = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Child1",
      parentDocId: root1.id,
    });

    // root1 and root2 are both roots (parentDocId=null), auto-ordered 0,1
    expect(root1.order).toBe(0);
    expect(root2.order).toBe(1);
    // child1 is under root1, so it starts at 0 within that scope
    expect(child1.order).toBe(0);
  });
});

describe("writing sprints", () => {
  it("creates sprint with defaults", async () => {
    const sprint = await createSprint({
      durationMs: 1500000,
      startWordCount: 100,
    });

    expect(sprint.status).toBe("active");
    expect(sprint.durationMs).toBe(1500000);
    expect(sprint.startWordCount).toBe(100);
    expect(sprint.projectId).toBeNull();
    expect(sprint.chapterId).toBeNull();
    expect(sprint.wordCountGoal).toBeNull();
    expect(sprint.totalPausedMs).toBe(0);
    expect(sprint.endWordCount).toBeNull();
  });

  it("creates sprint with project and chapter", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({ projectId: project.id, title: "Ch" });

    const sprint = await createSprint({
      durationMs: 1500000,
      startWordCount: 0,
      projectId: project.id,
      chapterId: chapter.id,
      wordCountGoal: 500,
    });

    expect(sprint.projectId).toBe(project.id);
    expect(sprint.chapterId).toBe(chapter.id);
    expect(sprint.wordCountGoal).toBe(500);
  });

  it("prevents multiple active sprints", async () => {
    await createSprint({ durationMs: 1500000, startWordCount: 0 });

    await expect(
      createSprint({ durationMs: 1500000, startWordCount: 0 }),
    ).rejects.toThrow("A sprint is already active.");
  });

  it("prevents creating sprint when paused sprint exists", async () => {
    const sprint = await createSprint({
      durationMs: 1500000,
      startWordCount: 0,
    });
    await pauseSprint(sprint.id);

    await expect(
      createSprint({ durationMs: 1500000, startWordCount: 0 }),
    ).rejects.toThrow("A sprint is already active.");
  });

  it("allows new sprint after previous one ends", async () => {
    const sprint1 = await createSprint({
      durationMs: 1500000,
      startWordCount: 0,
    });
    await endSprint(sprint1.id, 100);

    const sprint2 = await createSprint({
      durationMs: 1500000,
      startWordCount: 100,
    });
    expect(sprint2.status).toBe("active");
  });

  it("pause and resume tracks time correctly", async () => {
    const sprint = await createSprint({
      durationMs: 1500000,
      startWordCount: 0,
    });

    await pauseSprint(sprint.id);
    const paused = await getActiveSprint();
    expect(paused?.status).toBe("paused");
    expect(paused?.pausedAt).not.toBeNull();

    await resumeSprint(sprint.id);
    const resumed = await getActiveSprint();
    expect(resumed?.status).toBe("active");
    expect(resumed?.pausedAt).toBeNull();
    expect(resumed?.totalPausedMs).toBeGreaterThanOrEqual(0);
  });

  it("end sprint captures word count", async () => {
    const sprint = await createSprint({
      durationMs: 1500000,
      startWordCount: 50,
    });
    await endSprint(sprint.id, 150);

    const ended = await db.writingSprints.get(sprint.id);
    expect(ended?.status).toBe("completed");
    expect(ended?.endWordCount).toBe(150);
    expect(ended?.endedAt).not.toBeNull();
  });

  it("end sprint with abandoned flag", async () => {
    const sprint = await createSprint({
      durationMs: 1500000,
      startWordCount: 0,
    });
    await endSprint(sprint.id, 50, true);

    const ended = await db.writingSprints.get(sprint.id);
    expect(ended?.status).toBe("abandoned");
  });

  it("delete sprint removes it", async () => {
    const sprint = await createSprint({
      durationMs: 1500000,
      startWordCount: 0,
    });
    await endSprint(sprint.id, 100);

    await deleteSprint(sprint.id);

    const deleted = await db.writingSprints.get(sprint.id);
    expect(deleted).toBeUndefined();
  });

  it("getSprintsByProject returns only completed/abandoned sprints for project", async () => {
    const project = await createProject({ title: "P" });

    const sprint1 = await createSprint({
      durationMs: 1500000,
      startWordCount: 0,
      projectId: project.id,
    });
    await endSprint(sprint1.id, 100);

    const sprint2 = await createSprint({
      durationMs: 1500000,
      startWordCount: 100,
      projectId: project.id,
    });
    await endSprint(sprint2.id, 200, true);

    // Create active sprint - should not appear
    await createSprint({
      durationMs: 1500000,
      startWordCount: 200,
      projectId: project.id,
    });

    const history = await getSprintsByProject(project.id);
    expect(history).toHaveLength(2);
  });

  it("deleteProject cascades to sprints", async () => {
    const project = await createProject({ title: "P" });
    const sprint = await createSprint({
      durationMs: 1500000,
      startWordCount: 0,
      projectId: project.id,
    });
    await endSprint(sprint.id, 100);

    await deleteProject(project.id);

    const sprints = await getSprintsByProject(project.id);
    expect(sprints).toHaveLength(0);
  });
});

describe("writing sessions", () => {
  it("creates a session when recording writing activity", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    await recordWritingSession(project.id, chapter.id, 0, 100);

    const sessions = await getSessionsByProject(project.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].wordCountStart).toBe(0);
    expect(sessions[0].wordCountEnd).toBe(100);
    expect(sessions[0].chapterId).toBe(chapter.id);
  });

  it("tracks sessions with correct date and hour", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    await recordWritingSession(project.id, chapter.id, 0, 50);

    const sessions = await getSessionsByProject(project.id);
    const today = toLocalDateString(new Date());
    const currentHour = new Date().getHours();

    expect(sessions[0].date).toBe(today);
    expect(sessions[0].hourOfDay).toBe(currentHour);
  });

  it("updateChapterContent records a session when word count changes", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    await updateChapterContent(chapter.id, "Hello world", 2);

    // Give async operation time to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    const sessions = await getSessionsByProject(project.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].wordCountEnd).toBe(2);
  });

  it("does not record session when word count stays the same", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    // Update with same word count as default (0)
    await updateChapterContent(chapter.id, "", 0);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const sessions = await getSessionsByProject(project.id);
    expect(sessions).toHaveLength(0);
  });

  it("deleteProject cascades to writing sessions", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    await recordWritingSession(project.id, chapter.id, 0, 100);

    await deleteProject(project.id);

    const sessions = await getSessionsByProject(project.id);
    expect(sessions).toHaveLength(0);
  });

  it("getSessionsByProject respects days parameter", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    // Record a session for today
    await recordWritingSession(project.id, chapter.id, 0, 100);

    // Fetch with 30 days should include today's session
    const sessions30 = await getSessionsByProject(project.id, 30);
    expect(sessions30).toHaveLength(1);

    // Fetch with 0 days should still include today (boundary condition)
    const sessions0 = await getSessionsByProject(project.id, 0);
    expect(sessions0).toHaveLength(1);
  });
});

describe("recordWritingSession (session management)", () => {
  it("creates new session on first write", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    await recordWritingSession(project.id, chapter.id, 0, 100);

    const sessions = await getSessionsByProject(project.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].wordCountStart).toBe(0);
    expect(sessions[0].wordCountEnd).toBe(100);
    expect(sessions[0].durationMs).toBe(0);
  });

  it("extends existing session within timeout window", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    // First write
    await recordWritingSession(project.id, chapter.id, 0, 100);

    // Small delay to accumulate time
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Second write within timeout - should extend
    await recordWritingSession(project.id, chapter.id, 100, 200);

    const sessions = await getSessionsByProject(project.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].wordCountStart).toBe(0);
    expect(sessions[0].wordCountEnd).toBe(200);
    expect(sessions[0].durationMs).toBeGreaterThanOrEqual(50);
  });

  it("accumulates duration across multiple extensions", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    // First write
    await recordWritingSession(project.id, chapter.id, 0, 100);

    // Second write
    await new Promise((resolve) => setTimeout(resolve, 30));
    await recordWritingSession(project.id, chapter.id, 100, 150);

    // Third write
    await new Promise((resolve) => setTimeout(resolve, 30));
    await recordWritingSession(project.id, chapter.id, 150, 200);

    const sessions = await getSessionsByProject(project.id);
    expect(sessions).toHaveLength(1);
    // Duration should be sum of both intervals (~60ms total)
    expect(sessions[0].durationMs).toBeGreaterThanOrEqual(60);
  });

  it("creates separate sessions for different chapters", async () => {
    const project = await createProject({ title: "P" });
    const chapter1 = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });
    const chapter2 = await createChapter({
      projectId: project.id,
      title: "Ch2",
    });

    await recordWritingSession(project.id, chapter1.id, 0, 100);
    await recordWritingSession(project.id, chapter2.id, 0, 50);

    const sessions = await getSessionsByProject(project.id);
    expect(sessions).toHaveLength(2);
  });

  it("preserves wordCountStart when extending session", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    // Start at 500 words
    await recordWritingSession(project.id, chapter.id, 500, 600);

    // Extend
    await recordWritingSession(project.id, chapter.id, 600, 700);

    const sessions = await getSessionsByProject(project.id);
    expect(sessions).toHaveLength(1);
    // Original start should be preserved
    expect(sessions[0].wordCountStart).toBe(500);
    expect(sessions[0].wordCountEnd).toBe(700);
  });
});

describe("comments", () => {
  it("creates a comment with defaults", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    const comment = await createComment({
      projectId: project.id,
      chapterId: chapter.id,
      fromOffset: 10,
      toOffset: 20,
      anchorText: "some text",
    });

    expect(comment.projectId).toBe(project.id);
    expect(comment.chapterId).toBe(chapter.id);
    expect(comment.fromOffset).toBe(10);
    expect(comment.toOffset).toBe(20);
    expect(comment.anchorText).toBe("some text");
    expect(comment.content).toBe("");
    expect(comment.color).toBe("yellow");
    expect(comment.status).toBe("active");
    expect(comment.resolvedAt).toBeNull();
  });

  it("creates a positioned comment (from === to)", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    const comment = await createComment({
      projectId: project.id,
      chapterId: chapter.id,
      fromOffset: 50,
      toOffset: 50,
    });

    expect(comment.fromOffset).toBe(50);
    expect(comment.toOffset).toBe(50);
    expect(comment.anchorText).toBe("");
    expect(comment.content).toBe("");
  });

  it("retrieves comments by chapter sorted by fromOffset", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    await createComment({
      projectId: project.id,
      chapterId: chapter.id,
      fromOffset: 100,
      toOffset: 110,
    });
    await createComment({
      projectId: project.id,
      chapterId: chapter.id,
      fromOffset: 20,
      toOffset: 30,
    });
    await createComment({
      projectId: project.id,
      chapterId: chapter.id,
      fromOffset: 50,
      toOffset: 60,
    });

    const comments = await getCommentsByChapter(chapter.id);
    expect(comments).toHaveLength(3);
    expect(comments[0].fromOffset).toBe(20);
    expect(comments[1].fromOffset).toBe(50);
    expect(comments[2].fromOffset).toBe(100);
  });

  it("updates comment content and color", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    const comment = await createComment({
      projectId: project.id,
      chapterId: chapter.id,
      fromOffset: 0,
      toOffset: 10,
    });

    await updateComment(comment.id, {
      content: "This is a note",
      color: "blue",
    });

    const updated = await getComment(comment.id);
    expect(updated?.content).toBe("This is a note");
    expect(updated?.color).toBe("blue");
  });

  it("resolves a comment", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    const comment = await createComment({
      projectId: project.id,
      chapterId: chapter.id,
      fromOffset: 0,
      toOffset: 10,
    });

    await resolveComment(comment.id);

    const resolved = await getComment(comment.id);
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.resolvedAt).not.toBeNull();
  });

  it("deletes a comment", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    const comment = await createComment({
      projectId: project.id,
      chapterId: chapter.id,
      fromOffset: 0,
      toOffset: 10,
    });

    await deleteComment(comment.id);

    const deleted = await getComment(comment.id);
    expect(deleted).toBeUndefined();
  });

  it("deleteProject cascades to comments", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    await createComment({
      projectId: project.id,
      chapterId: chapter.id,
      fromOffset: 0,
      toOffset: 10,
    });

    await deleteProject(project.id);

    const comments = await getCommentsByChapter(chapter.id);
    expect(comments).toHaveLength(0);
  });

  it("comments on different chapters are isolated", async () => {
    const project = await createProject({ title: "P" });
    const chapter1 = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });
    const chapter2 = await createChapter({
      projectId: project.id,
      title: "Ch2",
    });

    await createComment({
      projectId: project.id,
      chapterId: chapter1.id,
      fromOffset: 0,
      toOffset: 10,
    });
    await createComment({
      projectId: project.id,
      chapterId: chapter2.id,
      fromOffset: 0,
      toOffset: 10,
    });

    const comments1 = await getCommentsByChapter(chapter1.id);
    const comments2 = await getCommentsByChapter(chapter2.id);

    expect(comments1).toHaveLength(1);
    expect(comments2).toHaveLength(1);
  });
});
