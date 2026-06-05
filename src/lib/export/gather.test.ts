import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { ChapterId } from "@/db/schemas";
import { makeChapter, makeProject, resetIdCounter } from "@/test/helpers";
import { gatherContent } from "./gather";
import type { ExportOptions } from "./types";

const project = makeProject({ title: "My Novel" });

function bookOptions(): ExportOptions {
  return {
    format: "markdown",
    scope: "book",
    projectId: project.id,
    includeTitlePage: false,
    includeChapterHeadings: true,
    pageBreaksBetweenChapters: false,
  };
}

describe("gatherContent", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    await db.projects.clear();
    await db.projects.add(project);
  });

  it("walks the manuscript tree depth-first, parent before children", async () => {
    // Ch1 (own prose) ┬ Scene A
    //                 └ Scene B
    // Ch2
    const ch1 = makeChapter({
      projectId: project.id,
      title: "Chapter 1",
      content: "Ch1 prose",
      order: 0,
    });
    const ch2 = makeChapter({
      projectId: project.id,
      title: "Chapter 2",
      content: "Ch2 prose",
      order: 1,
    });
    const sceneA = makeChapter({
      projectId: project.id,
      title: "Scene A",
      content: "A prose",
      parentChapterId: ch1.id,
      order: 0,
    });
    const sceneB = makeChapter({
      projectId: project.id,
      title: "Scene B",
      content: "B prose",
      parentChapterId: ch1.id,
      order: 1,
    });
    await db.chapters.bulkAdd([ch2, sceneB, ch1, sceneA]);

    const { chapters } = await gatherContent(bookOptions());
    expect(chapters.map((c) => c.title)).toEqual([
      "Chapter 1",
      "Scene A",
      "Scene B",
      "Chapter 2",
    ]);
    expect(chapters.map((c) => c.level)).toEqual([0, 1, 1, 0]);
    expect(chapters[0].content).toBe("Ch1 prose");
  });

  it("excludes scratchpad documents from the compiled book", async () => {
    const ch = makeChapter({
      projectId: project.id,
      title: "Chapter 1",
      order: 0,
    });
    const scratch = makeChapter({
      projectId: project.id,
      title: "Cut Material",
      section: "scratchpad",
      order: 0,
    });
    await db.chapters.bulkAdd([ch, scratch]);

    const { chapters } = await gatherContent(bookOptions());
    expect(chapters.map((c) => c.title)).toEqual(["Chapter 1"]);
  });

  it("includes a separator only when includeInCompile is set", async () => {
    const partOne = makeChapter({
      projectId: project.id,
      title: "Part One",
      kind: "separator",
      includeInCompile: true,
      pageBreakBefore: true,
      order: 0,
    });
    const ch = makeChapter({
      projectId: project.id,
      title: "Chapter 1",
      order: 1,
    });
    const hiddenDivider = makeChapter({
      projectId: project.id,
      title: "Notes Divider",
      kind: "separator",
      includeInCompile: false,
      order: 2,
    });
    await db.chapters.bulkAdd([partOne, ch, hiddenDivider]);

    const { chapters } = await gatherContent(bookOptions());
    expect(chapters.map((c) => c.title)).toEqual(["Part One", "Chapter 1"]);
    expect(chapters[0]).toMatchObject({
      isSeparator: true,
      pageBreakBefore: true,
    });
  });

  it("exports a single chapter with its subtree, depth normalized", async () => {
    const ch1 = makeChapter({
      projectId: project.id,
      title: "Chapter 1",
      order: 0,
    });
    const scene = makeChapter({
      projectId: project.id,
      title: "Scene A",
      parentChapterId: ch1.id,
      order: 0,
    });
    const ch2 = makeChapter({
      projectId: project.id,
      title: "Chapter 2",
      order: 1,
    });
    await db.chapters.bulkAdd([ch1, scene, ch2]);

    const { chapters } = await gatherContent({
      ...bookOptions(),
      scope: "chapter",
      chapterId: ch1.id as ChapterId,
    });
    expect(chapters.map((c) => c.title)).toEqual(["Chapter 1", "Scene A"]);
    // The exported root chapter is normalized to level 0.
    expect(chapters.map((c) => c.level)).toEqual([0, 1]);
  });
});
