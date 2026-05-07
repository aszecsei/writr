import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { createWorkUnit } from "@/db/operations/workUnits";
import type { AgentRunId, ChapterId, ProjectId } from "@/db/schemas";
import { makeChapter, resetIdCounter } from "@/test/helpers";
import { executeTool } from "../tools";
import type { ToolExecutionContext } from "../types";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const runId = "b2222222-2222-4222-9222-222222222222" as AgentRunId;
const otherRunId = "c3333333-3333-4333-a333-333333333333" as AgentRunId;

async function seedChapter(content: string) {
  const chapter = makeChapter({
    projectId,
    title: "Chapter 1",
    content,
  });
  await db.chapters.add(chapter);
  return chapter;
}

async function seedWorkUnit(chapterId: ChapterId, runIdOverride = runId) {
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

  it("stages a replace edit to the proposedEdits table", async () => {
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
        kind: "replace",
        anchorText: "ran swiftly down",
        newContent: "tore down",
        rationale: "cut the flat adverb",
      },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.data?.mode).toBe("pipeline");
    expect(result.data?.proposedEditId).toBeDefined();

    const persisted = await db.proposedEdits.toArray();
    expect(persisted).toHaveLength(1);
    const first = persisted[0];
    expect(first.kind).toBe("replace");
    expect(first.workUnitId).toBe(wu.id);
    expect(first.runId).toBe(runId);
    expect(first.newContent).toBe("tore down");
    if (first.kind !== "replace") throw new Error("expected replace");
    expect(first.anchorText).toBe("ran swiftly down");
    expect(first.prefix).toBeUndefined();
    expect(first.suffix).toBeUndefined();
  });

  it("stages a replace edit using prefix/suffix to disambiguate a repeated anchor", async () => {
    const chapter = await seedChapter("the good dog and the bad dog ran home");
    const wu = await seedWorkUnit(chapter.id);

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "replace",
        prefix: "the bad ",
        anchorText: "dog",
        suffix: " ran",
        newContent: "wolf",
      },
      { projectId, runId, workUnitId: wu.id },
    );

    expect(result.success).toBe(true);
    const persisted = await db.proposedEdits.toArray();
    expect(persisted).toHaveLength(1);
    const replaceEdit = persisted[0];
    if (replaceEdit.kind !== "replace") throw new Error("expected replace");
    expect(replaceEdit.prefix).toBe("the bad ");
    expect(replaceEdit.suffix).toBe(" ran");
  });

  it("rejects when the replace anchor is not in the chapter", async () => {
    const chapter = await seedChapter("Some other prose entirely.");
    const wu = await seedWorkUnit(chapter.id);

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "replace",
        anchorText: "not present anywhere",
        newContent: "replacement",
      },
      { projectId, runId, workUnitId: wu.id },
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
    expect(await db.proposedEdits.count()).toBe(0);
  });

  it("rejects when the combined replace anchor is not unique", async () => {
    const chapter = await seedChapter("the dog and the dog and the dog");
    const wu = await seedWorkUnit(chapter.id);

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "replace",
        anchorText: "dog",
        newContent: "wolf",
      },
      { projectId, runId, workUnitId: wu.id },
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not unique/i);
    expect(result.message).toMatch(/3/);
    expect(await db.proposedEdits.count()).toBe(0);
  });

  it("rejects when anchorText is empty", async () => {
    const chapter = await seedChapter("any prose");
    const wu = await seedWorkUnit(chapter.id);

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "replace",
        anchorText: "",
        newContent: "x",
      },
      { projectId, runId, workUnitId: wu.id },
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/non-empty anchorText/i);
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
      { projectId: "other-project" as ProjectId, runId, workUnitId: wu.id },
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

  it("returns a diff payload for a replace edit without persisting", async () => {
    const chapter = await seedChapter(
      "She walked quickly to the door and threw it open.",
    );

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "replace",
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
    expect(result.data?.kind).toBe("replace");
    expect(result.data?.originalText).toBe("walked quickly");
    expect(result.data?.newContent).toBe("strode");
    expect(result.data?.anchorFound).toBe(true);
    expect(result.data?.rationale).toBe("verb does the work; cut the adverb");

    expect(await db.proposedEdits.count()).toBe(0);
  });

  it("echoes prefix/suffix back in the chat payload", async () => {
    const chapter = await seedChapter("the good dog and the bad dog");

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "replace",
        prefix: "the bad ",
        anchorText: "dog",
        suffix: "",
        newContent: "wolf",
      },
      { projectId },
    );

    expect(result.success).toBe(true);
    expect(result.data?.prefix).toBe("the bad ");
    expect(result.data?.suffix).toBe("");
  });

  it("hard-fails in chat mode when replace anchor is not in chapter", async () => {
    const chapter = await seedChapter("Some other prose entirely.");

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "replace",
        anchorText: "not present anywhere",
        newContent: "replacement",
      },
      { projectId },
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
    expect(await db.proposedEdits.count()).toBe(0);
  });

  it("hard-fails in chat mode when combined replace anchor is not unique", async () => {
    const chapter = await seedChapter("dog and dog");

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "replace",
        anchorText: "dog",
        newContent: "wolf",
      },
      { projectId },
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not unique/i);
    expect(result.message).toMatch(/2/);
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
