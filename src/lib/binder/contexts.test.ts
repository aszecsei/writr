import { describe, expect, it } from "vitest";
import type { Chapter } from "@/db/schemas";
import { makeChapter, makeProject } from "@/test/helpers";
import { listComparisonContexts } from "./contexts";

const projectId = makeProject({ title: "Anthology" }).id;

function doc(title: string, order: number, parent?: Chapter): Chapter {
  return makeChapter({
    projectId,
    title,
    order,
    parentChapterId: parent?.id ?? null,
  });
}

function separator(title: string, order: number, parent?: Chapter): Chapter {
  return makeChapter({
    projectId,
    title,
    order,
    kind: "separator",
    parentChapterId: parent?.id ?? null,
  });
}

function titlesOf(items: Chapter[], ids: readonly string[]): string[] {
  return ids.map((id) => items.find((c) => c.id === id)?.title ?? "?");
}

function contextByTitle(items: Chapter[], title: string) {
  const context = listComparisonContexts(items).find((c) => c.title === title);
  if (!context) throw new Error(`no context titled ${title}`);
  return titlesOf(items, context.chapterIds);
}

describe("listComparisonContexts", () => {
  it("starts with the whole project in reading order", () => {
    const story = doc("Story", 1);
    const items = [
      doc("Ch 2", 1, story),
      story,
      doc("Prologue", 0),
      doc("Ch 1", 0, story),
    ];
    const [first] = listComparisonContexts(items);
    expect(first.kind).toBe("project");
    expect(titlesOf(items, first.chapterIds)).toEqual([
      "Prologue",
      "Story",
      "Ch 1",
      "Ch 2",
    ]);
  });

  it("offers a row with nested documents as its whole subtree", () => {
    const story = doc("Story", 0);
    const items = [story, doc("Ch 1", 0, story), doc("Other", 1)];
    expect(contextByTitle(items, "Story")).toEqual(["Story", "Ch 1"]);
  });

  it("groups the siblings after a separator up to the next one, including nested rows", () => {
    const a1 = doc("A1", 1);
    const items = [
      separator("Story A", 0),
      a1,
      doc("A1 scene", 0, a1),
      doc("A2", 2),
      separator("Story B", 3),
      doc("B1", 4),
    ];
    expect(contextByTitle(items, "Story A")).toEqual(["A1", "A1 scene", "A2"]);
    expect(contextByTitle(items, "Story B")).toEqual(["B1"]);
  });

  it("includes a separator's own children in its group", () => {
    const sep = separator("Part One", 1);
    const items = [
      doc("Intro", 0),
      sep,
      doc("Nested", 0, sep),
      doc("After", 2),
    ];
    expect(contextByTitle(items, "Part One")).toEqual(["Nested", "After"]);
  });

  it("finds separator groups nested inside a folder", () => {
    const folder = doc("Anthology", 0);
    const items = [
      folder,
      separator("Tale", 0, folder),
      doc("Tale ch", 1, folder),
      doc("Elsewhere", 1),
    ];
    const tale = listComparisonContexts(items).find((c) => c.title === "Tale");
    expect(tale?.depth).toBe(1);
    expect(titlesOf(items, tale?.chapterIds ?? [])).toEqual(["Tale ch"]);
  });

  it("offers top-level documents on their own, but not nested leaves", () => {
    const story = doc("Story", 0);
    const items = [story, doc("Nested leaf", 0, story), doc("Standalone", 1)];
    const titles = listComparisonContexts(items).map((c) => c.title);
    expect(titles).toContain("Standalone");
    expect(titles).not.toContain("Nested leaf");
  });

  it("never includes separators or scratchpad rows as documents", () => {
    const items = [
      separator("Act", 0),
      doc("Ch 1", 1),
      makeChapter({ projectId, title: "Notes", section: "scratchpad" }),
    ];
    for (const context of listComparisonContexts(items)) {
      expect(titlesOf(items, context.chapterIds)).not.toContain("Act");
      expect(titlesOf(items, context.chapterIds)).not.toContain("Notes");
    }
  });

  it("drops contexts covering the same documents as an earlier one", () => {
    const story = doc("Only story", 0);
    const items = [story, doc("Ch 1", 0, story)];
    expect(listComparisonContexts(items).map((c) => c.kind)).toEqual([
      "project",
    ]);
  });
});
