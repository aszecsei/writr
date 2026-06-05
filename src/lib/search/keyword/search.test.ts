import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import {
  createChapter,
  createCharacter,
  createLocation,
  createProject,
  createStyleGuideEntry,
  createTimelineEvent,
  createWorldbuildingDoc,
} from "@/db/operations";
import type { ChapterId, ProjectId } from "@/db/schemas";
import {
  searchChapterParagraphsKeyword,
  searchChaptersKeyword,
  searchProjectKeywordGrouped,
  searchProjectKeywordPaginated,
} from "./search";

let projectId: ProjectId;

beforeEach(async () => {
  await db.projects.clear();
  await db.chapters.clear();
  await db.characters.clear();
  await db.locations.clear();
  await db.timelineEvents.clear();
  await db.styleGuideEntries.clear();
  await db.worldbuildingDocs.clear();
  await db.outlineGridCells.clear();
  await db.outlineGridRows.clear();
  await db.outlineGridColumns.clear();

  const project = await createProject({ title: "Test Project" });
  projectId = project.id;
});

describe("searchProjectKeywordGrouped", () => {
  it("returns empty for empty query", async () => {
    await createChapter({ projectId, title: "Chapter One" });
    expect(await searchProjectKeywordGrouped(projectId, "")).toEqual([]);
    expect(await searchProjectKeywordGrouped(projectId, "   ")).toEqual([]);
  });

  it("finds chapters by title", async () => {
    await createChapter({ projectId, title: "The Beginning" });
    await createChapter({ projectId, title: "The Middle" });

    const groups = await searchProjectKeywordGrouped(projectId, "beginning");
    expect(groups.length).toBe(1);
    expect(groups[0].entityType).toBe("chapter");
    expect(groups[0].results[0].title).toBe("The Beginning");
  });

  it("finds chapters by content", async () => {
    const chapter = await createChapter({ projectId, title: "Chapter One" });
    await db.chapters.update(chapter.id, {
      content: "Alice walked into the room.",
    });

    const groups = await searchProjectKeywordGrouped(projectId, "alice");
    expect(groups.length).toBe(1);
    expect(groups[0].results[0].matchField).toBe("content");
  });

  it("finds character by alias", async () => {
    const c = await createCharacter({ projectId, name: "Elizabeth" });
    await db.characters.update(c.id, { aliases: ["Liz", "Beth", "Lizzy"] });

    const groups = await searchProjectKeywordGrouped(projectId, "lizzy");
    expect(groups.length).toBe(1);
    expect(groups[0].results[0].matchField).toBe("aliases");
  });

  it("OR-combines multi-keyword queries (wide net)", async () => {
    // None of these chapters contain the literal phrase 'garden moon silver',
    // but each contains a subset of the terms. The substring search would
    // miss them all; BM25 finds them.
    await createChapter({
      projectId,
      title: "A",
      content: "The garden lay quiet under the silver moon.",
    });
    await createChapter({
      projectId,
      title: "B",
      content: "Moonlight threaded through the trees.",
    });
    await createChapter({
      projectId,
      title: "C",
      content: "She walked alone in the city of silver towers.",
    });

    const groups = await searchProjectKeywordGrouped(
      projectId,
      "garden moon silver",
    );
    expect(groups.length).toBe(1);
    expect(groups[0].results.length).toBe(3);
    // The chapter that hits all three terms should rank first.
    expect(groups[0].results[0].title).toBe("A");
  });

  it("ranks title hits above body-only hits", async () => {
    await createChapter({
      projectId,
      title: "Chronicle Two",
      content:
        "The dragon flew over the dragon mountain that the dragon owned.",
    });
    await createChapter({
      projectId,
      title: "Dragon Day",
      content: "Quiet morning in the village.",
    });

    const groups = await searchProjectKeywordGrouped(projectId, "dragon");
    expect(groups[0].results[0].title).toBe("Dragon Day");
  });

  it("supports prefix match", async () => {
    await createChapter({
      projectId,
      title: "Chapter One",
      content: "Wandered into the gardener's shed",
    });
    const groups = await searchProjectKeywordGrouped(projectId, "garden");
    expect(groups.length).toBe(1);
    expect(groups[0].results[0].id).toBeDefined();
  });

  it("tolerates a single-character typo via fuzzy", async () => {
    await createChapter({
      projectId,
      title: "Chapter",
      content: "She walked through the moonlit garden",
    });
    // "moonlt" is 1 deletion from "moonlit" — within fuzzy 0.15 (≈1 edit
    // for a 7-char term).
    const groups = await searchProjectKeywordGrouped(projectId, "moonlt");
    expect(groups.length).toBe(1);
  });

  it("limits results per category", async () => {
    for (let i = 0; i < 10; i++) {
      await createChapter({ projectId, title: `Test Chapter ${i}` });
    }
    const groups = await searchProjectKeywordGrouped(projectId, "test", 3);
    expect(groups[0].results.length).toBe(3);
  });

  it("is case-insensitive", async () => {
    await createChapter({ projectId, title: "UPPERCASE TITLE" });
    const groups = await searchProjectKeywordGrouped(projectId, "uppercase");
    expect(groups.length).toBe(1);
  });

  it("returns groups in the canonical entity-type order", async () => {
    await createWorldbuildingDoc({ projectId, title: "Test Doc" });
    await createCharacter({ projectId, name: "Test Character" });
    await createChapter({ projectId, title: "Test Chapter" });

    const groups = await searchProjectKeywordGrouped(projectId, "test");
    expect(groups.map((g) => g.entityType)).toEqual([
      "chapter",
      "character",
      "worldbuildingDoc",
    ]);
  });

  it("emits result urls that include project and entity ids", async () => {
    await createChapter({ projectId, title: "Test Chapter" });
    await createCharacter({ projectId, name: "Test Character" });
    const groups = await searchProjectKeywordGrouped(projectId, "test");
    for (const group of groups) {
      for (const result of group.results) {
        expect(result.url).toContain(projectId);
        expect(result.url).toContain(result.id);
      }
    }
  });
});

describe("searchProjectKeywordPaginated", () => {
  it("returns empty for empty query", async () => {
    await createChapter({ projectId, title: "Chapter One" });
    const r = await searchProjectKeywordPaginated(projectId, "");
    expect(r.results).toEqual([]);
    expect(r.totalCount).toBe(0);
  });

  it("paginates results", async () => {
    for (let i = 0; i < 25; i++) {
      await createChapter({ projectId, title: `Test Chapter ${i}` });
    }

    const page1 = await searchProjectKeywordPaginated(projectId, "test", 1, 10);
    expect(page1.results.length).toBe(10);
    expect(page1.totalCount).toBe(25);
    expect(page1.totalPages).toBe(3);

    const page3 = await searchProjectKeywordPaginated(projectId, "test", 3, 10);
    expect(page3.results.length).toBe(5);
  });

  it("filters by entity type", async () => {
    await createChapter({ projectId, title: "Test Chapter" });
    await createCharacter({ projectId, name: "Test Character" });
    await createLocation({ projectId, name: "Test Location" });

    const chaptersOnly = await searchProjectKeywordPaginated(
      projectId,
      "test",
      1,
      20,
      ["chapter"],
    );
    expect(chaptersOnly.totalCount).toBe(1);
    expect(chaptersOnly.results[0].entityType).toBe("chapter");

    const charsAndLocs = await searchProjectKeywordPaginated(
      projectId,
      "test",
      1,
      20,
      ["character", "location"],
    );
    expect(charsAndLocs.totalCount).toBe(2);
  });
});

describe("quoted-phrase fast-path", () => {
  it("requires the literal substring even when individual tokens match", async () => {
    await createChapter({
      projectId,
      title: "A",
      content: "The moonlit garden glowed.",
    });
    await createChapter({
      projectId,
      title: "B",
      content: "She liked the moon. She liked the garden too.",
    });

    const r = await searchProjectKeywordPaginated(
      projectId,
      '"moonlit garden"',
    );
    expect(r.totalCount).toBe(1);
    expect(r.results[0].title).toBe("A");
  });

  it("combines BM25 tokens with phrase post-filter", async () => {
    // 'flames' filters the candidate set via BM25; the phrase post-filter
    // keeps only docs that also contain the literal "moonlit garden".
    await createChapter({
      projectId,
      title: "A",
      content: "The moonlit garden burned with bright flames.",
    });
    await createChapter({
      projectId,
      title: "B",
      content: "Flames danced everywhere, but no garden.",
    });
    await createChapter({
      projectId,
      title: "C",
      content: "A peaceful moonlit garden, no fire.",
    });

    const r = await searchProjectKeywordPaginated(
      projectId,
      'flames "moonlit garden"',
    );
    expect(r.results.map((x) => x.title)).toEqual(["A"]);
  });

  it("matches phrase against title, alias, and other indexed fields", async () => {
    const c = await createCharacter({ projectId, name: "Elizabeth" });
    await db.characters.update(c.id, { aliases: ["Liz the Brave"] });
    const r = await searchProjectKeywordPaginated(projectId, '"Liz the Brave"');
    expect(r.totalCount).toBe(1);
    expect(r.results[0].entityType).toBe("character");
  });
});

describe("searchChaptersKeyword", () => {
  it("returns empty for empty query", async () => {
    await createChapter({ projectId, title: "One" });
    expect(await searchChaptersKeyword(projectId, "")).toEqual([]);
  });

  it("finds chapters by content with BM25 ranking", async () => {
    await createChapter({
      projectId,
      title: "A",
      content: "The garden lay quiet under the silver moon.",
    });
    await createChapter({
      projectId,
      title: "B",
      content: "Moonlight threaded through the trees.",
    });
    const matches = await searchChaptersKeyword(projectId, "garden moon");
    expect(matches.length).toBe(2);
    expect(matches[0].title).toBe("A");
  });

  it("respects the readable-chapter set", async () => {
    const c1 = await createChapter({ projectId, title: "First" });
    await db.chapters.update(c1.id, { content: "garden", order: 0 });
    const c2 = await createChapter({ projectId, title: "Second" });
    await db.chapters.update(c2.id, { content: "garden", order: 1 });
    const c3 = await createChapter({ projectId, title: "Third" });
    await db.chapters.update(c3.id, { content: "garden", order: 2 });

    const matches = await searchChaptersKeyword(projectId, "garden", {
      readableChapterIds: new Set([c1.id, c2.id]),
    });
    const titles = matches.map((m) => m.title).sort();
    expect(titles).toEqual(["First", "Second"]);
  });

  it("returns 1-indexed paragraph numbers and respects maxResults", async () => {
    const chapter = await createChapter({ projectId, title: "C" });
    const paragraphs = [
      "The garden lay quiet.",
      "Trees rustled.",
      "Inside the garden a fountain whispered.",
      "An owl called.",
      "Beyond the garden, lights flickered.",
    ];
    await db.chapters.update(chapter.id, {
      content: paragraphs.join("\n\n"),
    });

    const result = await searchChapterParagraphsKeyword(
      chapter.id as ChapterId,
      "garden",
      { maxResults: 2, contextParagraphs: 0 },
    );
    expect(result.chapter?.title).toBe("C");
    expect(result.matches.length).toBe(2);
    // Paragraph numbers are 1-indexed in the API.
    expect(result.matches.every((m) => m.paragraph >= 1)).toBe(true);
  });

  it("includes context paragraphs in snippet", async () => {
    const chapter = await createChapter({ projectId, title: "C" });
    const paragraphs = [
      "Before paragraph.",
      "The garden lay quiet.",
      "After paragraph.",
    ];
    await db.chapters.update(chapter.id, {
      content: paragraphs.join("\n\n"),
    });

    const result = await searchChapterParagraphsKeyword(
      chapter.id as ChapterId,
      "garden",
      { contextParagraphs: 1 },
    );
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].snippet).toContain("Before paragraph");
    expect(result.matches[0].snippet).toContain("After paragraph");
  });
});

describe("entity coverage", () => {
  it("indexes timeline events, style guide, worldbuilding, location", async () => {
    await createTimelineEvent({ projectId, title: "Ancient Battle" });
    await createStyleGuideEntry({ projectId, title: "Active Voice" });
    await createWorldbuildingDoc({ projectId, title: "Magic" });
    await createLocation({ projectId, name: "Dark Forest" });

    expect(
      (await searchProjectKeywordGrouped(projectId, "ancient")).length,
    ).toBe(1);
    expect(
      (await searchProjectKeywordGrouped(projectId, "active")).length,
    ).toBe(1);
    expect((await searchProjectKeywordGrouped(projectId, "magic")).length).toBe(
      1,
    );
    expect(
      (await searchProjectKeywordGrouped(projectId, "forest")).length,
    ).toBe(1);
  });
});
