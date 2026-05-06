import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { createWorkUnit } from "@/db/operations/workUnits";
import { makeChapter, resetIdCounter } from "@/test/helpers";
import { executeTool } from "../tools";
import type { ToolExecutionContext } from "../types";

const projectId = "a1111111-1111-4111-a111-111111111111";
const runId = "b2222222-2222-4222-9222-222222222222";
const otherRunId = "c3333333-3333-4333-a333-333333333333";

async function seedChapter(content: string) {
  const chapter = makeChapter({
    projectId,
    title: "Chapter 1",
    content,
  });
  await db.chapters.add(chapter);
  return chapter;
}

async function seedWorkUnit(chapterId: string, runIdOverride = runId) {
  return createWorkUnit({
    projectId,
    runId: runIdOverride,
    tier: 1,
    goal: "tighten the second paragraph",
    requiredBeats: [],
    constraints: [],
    placement: { chapterId, position: "replace" },
    targetLengthWords: null,
    bibleRefs: [],
    sourceNoteIds: [],
    dependencies: [],
  });
}

describe("propose_edit (pipeline mode — workUnitId in context)", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    await db.workUnits.clear();
    await db.proposedEdits.clear();
  });

  it("stages a replace_range edit to the proposedEdits table", async () => {
    const chapter = await seedChapter("the dog ran swiftly down the road");
    const wu = await seedWorkUnit(chapter.id);

    const ctx: ToolExecutionContext = {
      projectId,
      runId,
      workUnitId: wu.id,
      agentKind: "editor",
    };

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "replace_range",
        fromOffset: 4,
        toOffset: 22,
        anchorText: "dog ran swiftly down",
        newContent: "dog tore down",
        rationale: "cut the flat adverb",
      },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.data?.mode).toBe("pipeline");
    expect(result.data?.proposedEditId).toBeDefined();

    const persisted = await db.proposedEdits.toArray();
    expect(persisted).toHaveLength(1);
    expect(persisted[0].workUnitId).toBe(wu.id);
    expect(persisted[0].runId).toBe(runId);
    expect(persisted[0].newContent).toBe("dog tore down");
  });

  it("rejects when context.runId is missing", async () => {
    const chapter = await seedChapter("text");
    const wu = await seedWorkUnit(chapter.id);

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "append",
        newContent: "an added line",
      },
      { projectId, workUnitId: wu.id },
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/run context/i);
    expect(await db.proposedEdits.count()).toBe(0);
  });

  it("rejects when the work unit belongs to a different run", async () => {
    const chapter = await seedChapter("text");
    const wu = await seedWorkUnit(chapter.id, otherRunId);

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "append",
        newContent: "added",
      },
      { projectId, runId, workUnitId: wu.id },
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/different run/i);
    expect(await db.proposedEdits.count()).toBe(0);
  });

  it("rejects when the chapter belongs to a different project", async () => {
    const chapter = await seedChapter("text");
    const wu = await seedWorkUnit(chapter.id);

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "append",
        newContent: "added",
      },
      { projectId: "other-project", runId, workUnitId: wu.id },
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/different project/i);
  });
});

describe("propose_edit (chat mode — no workUnitId)", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    await db.workUnits.clear();
    await db.proposedEdits.clear();
  });

  it("returns a diff payload without persisting when workUnitId is absent", async () => {
    const chapter = await seedChapter(
      "She walked quickly to the door and threw it open.",
    );

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "replace_range",
        fromOffset: 4,
        toOffset: 18,
        anchorText: "walked quickly",
        newContent: "strode",
        rationale: "verb does the work; cut the adverb",
      },
      { projectId },
    );

    expect(result.success).toBe(true);
    expect(result.data?.mode).toBe("chat");
    expect(result.data?.chapterId).toBe(chapter.id);
    expect(result.data?.chapterTitle).toBe("Chapter 1");
    expect(result.data?.kind).toBe("replace_range");
    expect(result.data?.originalText).toBe("walked quickly");
    expect(result.data?.newContent).toBe("strode");
    expect(result.data?.anchorFound).toBe(true);
    expect(result.data?.rationale).toBe("verb does the work; cut the adverb");

    expect(await db.proposedEdits.count()).toBe(0);
  });

  it("flags anchorFound:false when anchorText is not in the chapter", async () => {
    const chapter = await seedChapter("Some other prose entirely.");

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "replace_range",
        fromOffset: 0,
        toOffset: 5,
        anchorText: "not present anywhere",
        newContent: "replacement",
      },
      { projectId },
    );

    expect(result.success).toBe(true);
    expect(result.data?.anchorFound).toBe(false);
    expect(result.data?.originalText).toBe("not present anywhere");
    expect(await db.proposedEdits.count()).toBe(0);
  });

  it("returns the whole chapter as originalText for full_chapter", async () => {
    const chapter = await seedChapter("Original chapter content.");

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "full_chapter",
        newContent: "Brand new chapter prose.",
      },
      { projectId },
    );

    expect(result.success).toBe(true);
    expect(result.data?.mode).toBe("chat");
    expect(result.data?.originalText).toBe("Original chapter content.");
    expect(result.data?.anchorFound).toBe(true);
  });

  it("treats append as anchorFound:true with empty originalText", async () => {
    const chapter = await seedChapter("Existing content.");

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "append",
        newContent: "Postscript paragraph.",
      },
      { projectId },
    );

    expect(result.success).toBe(true);
    expect(result.data?.anchorFound).toBe(true);
    expect(result.data?.originalText).toBe("");
  });
});
