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
import {
  getTotalResultCount,
  searchProject,
  searchProjectPaginated,
} from "./search";

let projectId: string;

beforeEach(async () => {
  await db.projects.clear();
  await db.chapters.clear();
  await db.characters.clear();
  await db.locations.clear();
  await db.timelineEvents.clear();
  await db.styleGuideEntries.clear();
  await db.worldbuildingDocs.clear();

  const project = await createProject({ title: "Test Project" });
  projectId = project.id;
});

describe("searchProject", () => {
  it("returns empty results for empty query", async () => {
    await createChapter({ projectId, title: "Chapter One" });
    const results = await searchProject(projectId, "");
    expect(results).toEqual([]);
  });

  it("returns empty results for whitespace query", async () => {
    await createChapter({ projectId, title: "Chapter One" });
    const results = await searchProject(projectId, "   ");
    expect(results).toEqual([]);
  });

  it("finds chapters by title", async () => {
    await createChapter({ projectId, title: "The Beginning" });
    await createChapter({ projectId, title: "The Middle" });

    const results = await searchProject(projectId, "beginning");
    expect(results.length).toBe(1);
    expect(results[0].entityType).toBe("chapter");
    expect(results[0].results[0].title).toBe("The Beginning");
  });

  it("finds chapters by content", async () => {
    const chapter = await createChapter({ projectId, title: "Chapter One" });
    await db.chapters.update(chapter.id, {
      content: "Alice walked into the room.",
    });

    const results = await searchProject(projectId, "alice");
    expect(results.length).toBe(1);
    expect(results[0].entityType).toBe("chapter");
    expect(results[0].results[0].matchField).toBe("content");
  });

  it("finds characters by name", async () => {
    await createCharacter({ projectId, name: "Alice Smith" });
    await createCharacter({ projectId, name: "Bob Jones" });

    const results = await searchProject(projectId, "alice");
    expect(results.length).toBe(1);
    expect(results[0].entityType).toBe("character");
    expect(results[0].results[0].title).toBe("Alice Smith");
  });

  it("finds characters by aliases", async () => {
    const char = await createCharacter({ projectId, name: "Elizabeth" });
    await db.characters.update(char.id, { aliases: ["Liz", "Beth", "Lizzy"] });

    const results = await searchProject(projectId, "lizzy");
    expect(results.length).toBe(1);
    expect(results[0].entityType).toBe("character");
    expect(results[0].results[0].matchField).toBe("aliases");
  });

  it("finds locations by name", async () => {
    await createLocation({ projectId, name: "Dark Forest" });

    const results = await searchProject(projectId, "forest");
    expect(results.length).toBe(1);
    expect(results[0].entityType).toBe("location");
  });

  it("finds timeline events by title", async () => {
    await createTimelineEvent({ projectId, title: "The Great Battle" });

    const results = await searchProject(projectId, "battle");
    expect(results.length).toBe(1);
    expect(results[0].entityType).toBe("timelineEvent");
  });

  it("finds style guide entries by title", async () => {
    await createStyleGuideEntry({ projectId, title: "Use active voice" });

    const results = await searchProject(projectId, "active");
    expect(results.length).toBe(1);
    expect(results[0].entityType).toBe("styleGuideEntry");
  });

  it("finds worldbuilding docs by title", async () => {
    await createWorldbuildingDoc({ projectId, title: "Magic System" });

    const results = await searchProject(projectId, "magic");
    expect(results.length).toBe(1);
    expect(results[0].entityType).toBe("worldbuildingDoc");
  });

  it("finds worldbuilding docs by tags", async () => {
    const doc = await createWorldbuildingDoc({ projectId, title: "Lore" });
    await db.worldbuildingDocs.update(doc.id, { tags: ["history", "ancient"] });

    const results = await searchProject(projectId, "ancient");
    expect(results.length).toBe(1);
    expect(results[0].entityType).toBe("worldbuildingDoc");
    expect(results[0].results[0].matchField).toBe("tags");
  });

  it("returns results from multiple entity types", async () => {
    await createChapter({ projectId, title: "Dragon Chapter" });
    await createCharacter({ projectId, name: "Dragon Lord" });
    await createLocation({ projectId, name: "Dragon Mountain" });

    const results = await searchProject(projectId, "dragon");
    expect(results.length).toBe(3);

    const types = results.map((r) => r.entityType);
    expect(types).toContain("chapter");
    expect(types).toContain("character");
    expect(types).toContain("location");
  });

  it("limits results per category", async () => {
    for (let i = 0; i < 10; i++) {
      await createChapter({ projectId, title: `Test Chapter ${i}` });
    }

    const results = await searchProject(projectId, "test", 3);
    expect(results[0].results.length).toBe(3);
  });

  it("is case-insensitive", async () => {
    await createChapter({ projectId, title: "UPPERCASE TITLE" });

    const results = await searchProject(projectId, "uppercase");
    expect(results.length).toBe(1);
  });

  it("generates correct URLs", async () => {
    await createChapter({ projectId, title: "Test Chapter" });
    await createCharacter({ projectId, name: "Test Character" });
    await createLocation({ projectId, name: "Test Location" });
    await createTimelineEvent({ projectId, title: "Test Event" });
    await createStyleGuideEntry({ projectId, title: "Test Rule" });
    await createWorldbuildingDoc({ projectId, title: "Test Doc" });

    const results = await searchProject(projectId, "test");

    for (const group of results) {
      for (const result of group.results) {
        expect(result.url).toContain(projectId);
        expect(result.url).toContain(result.id);
      }
    }
  });
});

describe("searchProjectPaginated", () => {
  it("returns empty results for empty query", async () => {
    await createChapter({ projectId, title: "Chapter One" });
    const results = await searchProjectPaginated(projectId, "");
    expect(results.results).toEqual([]);
    expect(results.totalCount).toBe(0);
  });

  it("returns paginated results", async () => {
    for (let i = 0; i < 25; i++) {
      await createChapter({ projectId, title: `Test Chapter ${i}` });
    }

    const page1 = await searchProjectPaginated(projectId, "test", 1, 10);
    expect(page1.results.length).toBe(10);
    expect(page1.totalCount).toBe(25);
    expect(page1.page).toBe(1);
    expect(page1.totalPages).toBe(3);

    const page2 = await searchProjectPaginated(projectId, "test", 2, 10);
    expect(page2.results.length).toBe(10);
    expect(page2.page).toBe(2);

    const page3 = await searchProjectPaginated(projectId, "test", 3, 10);
    expect(page3.results.length).toBe(5);
  });

  it("filters by entity type", async () => {
    await createChapter({ projectId, title: "Test Chapter" });
    await createCharacter({ projectId, name: "Test Character" });
    await createLocation({ projectId, name: "Test Location" });

    const chaptersOnly = await searchProjectPaginated(
      projectId,
      "test",
      1,
      20,
      ["chapter"],
    );
    expect(chaptersOnly.totalCount).toBe(1);
    expect(chaptersOnly.results[0].entityType).toBe("chapter");

    const charsAndLocs = await searchProjectPaginated(
      projectId,
      "test",
      1,
      20,
      ["character", "location"],
    );
    expect(charsAndLocs.totalCount).toBe(2);
  });

  it("returns flat results not grouped", async () => {
    await createChapter({ projectId, title: "Test Chapter" });
    await createCharacter({ projectId, name: "Test Character" });

    const results = await searchProjectPaginated(projectId, "test");
    expect(Array.isArray(results.results)).toBe(true);
    expect(results.results[0]).toHaveProperty("entityType");
    expect(results.results[0]).toHaveProperty("title");
    expect(results.results[0]).toHaveProperty("url");
  });
});

describe("getTotalResultCount", () => {
  it("returns 0 for empty groups", () => {
    expect(getTotalResultCount([])).toBe(0);
  });

  it("sums results across all groups", async () => {
    await createChapter({ projectId, title: "Test 1" });
    await createChapter({ projectId, title: "Test 2" });
    await createCharacter({ projectId, name: "Test Char" });

    const results = await searchProject(projectId, "test");
    const total = getTotalResultCount(results);
    expect(total).toBe(3);
  });
});
