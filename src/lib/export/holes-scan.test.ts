import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { makeChapter, makeProject, resetIdCounter } from "@/test/helpers";
import { scanExportHoles } from "./holes-scan";
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

describe("scanExportHoles", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    await db.projects.clear();
    await db.appSettings.clear();
    await db.projects.add(project);
  });

  it("returns per-chapter hole counts across the exported book", async () => {
    await db.chapters.bulkAdd([
      makeChapter({
        projectId: project.id,
        title: "Chapter 1",
        content: "intro [a hole] and [another]",
        order: 0,
      }),
      makeChapter({
        projectId: project.id,
        title: "Chapter 2",
        content: "clean prose, no holes",
        order: 1,
      }),
      makeChapter({
        projectId: project.id,
        title: "Chapter 3",
        content: "[just one]",
        order: 2,
      }),
    ]);

    const scan = await scanExportHoles(bookOptions());
    expect(scan.total).toBe(3);
    expect(scan.chapters).toEqual([
      { title: "Chapter 1", count: 2 },
      { title: "Chapter 3", count: 1 },
    ]);
  });

  it("reports no holes for clean material", async () => {
    await db.chapters.add(
      makeChapter({
        projectId: project.id,
        title: "Chapter 1",
        content: "all finished prose here",
        order: 0,
      }),
    );

    const scan = await scanExportHoles(bookOptions());
    expect(scan.total).toBe(0);
    expect(scan.chapters).toEqual([]);
  });
});
