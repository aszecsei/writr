import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { ProjectId } from "@/db/schemas";
import { makeChapter, resetIdCounter } from "@/test/helpers";
import { executeTool } from "../tools";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;

async function seedChapter(content: string) {
  const chapter = makeChapter({
    projectId,
    title: "Chapter 1",
    content,
  });
  await db.chapters.add(chapter);
  return chapter;
}

describe("propose_edit (render-only diff payload)", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
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
    expect(result.data?.chapterId).toBe(chapter.id);
    expect(result.data?.chapterTitle).toBe("Chapter 1");
    expect(result.data?.kind).toBe("replace");
    expect(result.data?.originalText).toBe("walked quickly");
    expect(result.data?.newContent).toBe("strode");
    expect(result.data?.anchorFound).toBe(true);
    expect(result.data?.rationale).toBe("verb does the work; cut the adverb");
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

  it("hard-fails when replace anchor is not in chapter", async () => {
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
  });

  it("hard-fails when combined replace anchor is not unique", async () => {
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

  it("reports anchorFound:true when quote form differs", async () => {
    const chapter = await seedChapter("She said “hello” and waved.");

    const result = await executeTool(
      "propose_edit",
      {
        chapterId: chapter.id,
        kind: "replace",
        anchorText: 'said "hello"',
        newContent: 'whispered "hi"',
      },
      { projectId },
    );

    expect(result.success).toBe(true);
    expect(result.data?.anchorFound).toBe(true);
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
