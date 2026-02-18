import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import {
  makeChapter,
  makeCharacter,
  makeLocation,
  makeOutlineGridCell,
  makeOutlineGridColumn,
  makeOutlineGridRow,
  makeStyleGuideEntry,
  makeTimelineEvent,
  makeWorldbuildingDoc,
  resetIdCounter,
} from "@/test/helpers";
import { AI_TOOL_MAP, executeTool, getToolDefinitionsForModel } from "./tools";

const projectId = "a1111111-1111-4111-a111-111111111111";
const ctx = { projectId };

describe("tool registry", () => {
  it("exports 27 tool definitions", () => {
    expect(getToolDefinitionsForModel()).toHaveLength(27);
  });

  it("has unique tool IDs", () => {
    const defs = getToolDefinitionsForModel();
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("character tools", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.characters.clear();
  });

  it("create_character creates a character", async () => {
    const result = await executeTool(
      "create_character",
      { name: "Elena", role: "protagonist", description: "A brave explorer" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Elena");

    const chars = await db.characters.where({ projectId }).toArray();
    expect(chars).toHaveLength(1);
    expect(chars[0].name).toBe("Elena");
    expect(chars[0].role).toBe("protagonist");
  });

  it("get_character returns character details", async () => {
    const char = makeCharacter({
      projectId,
      name: "Bob",
      role: "antagonist",
    });
    await db.characters.add(char);

    const result = await executeTool("get_character", { id: char.id }, ctx);
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Bob");
    expect(result.data?.role).toBe("antagonist");
  });

  it("get_character fails for unknown ID", async () => {
    const result = await executeTool(
      "get_character",
      { id: "nonexistent" },
      ctx,
    );
    expect(result.success).toBe(false);
  });

  it("update_character modifies fields", async () => {
    const char = makeCharacter({ projectId, name: "Carol" });
    await db.characters.add(char);

    const result = await executeTool(
      "update_character",
      { id: char.id, role: "protagonist" },
      ctx,
    );
    expect(result.success).toBe(true);

    const updated = await db.characters.get(char.id);
    expect(updated?.role).toBe("protagonist");
  });

  it("list_characters returns all characters", async () => {
    await db.characters.bulkAdd([
      makeCharacter({ projectId, name: "A" }),
      makeCharacter({ projectId, name: "B" }),
    ]);

    const result = await executeTool("list_characters", {}, ctx);
    expect(result.success).toBe(true);
    expect(
      (result.data?.characters as { id: string; name: string }[]).length,
    ).toBe(2);
  });
});

describe("location tools", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.locations.clear();
  });

  it("create_location creates a location", async () => {
    const result = await executeTool(
      "create_location",
      { name: "The Forest", description: "A dark forest" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("The Forest");

    const locs = await db.locations.where({ projectId }).toArray();
    expect(locs).toHaveLength(1);
  });

  it("get_location returns location details", async () => {
    const loc = await executeTool("create_location", { name: "Castle" }, ctx);
    const result = await executeTool(
      "get_location",
      { id: loc.data?.id as string },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Castle");
  });

  it("update_location modifies fields", async () => {
    const created = await executeTool(
      "create_location",
      { name: "Village" },
      ctx,
    );
    const result = await executeTool(
      "update_location",
      { id: created.data?.id as string, description: "A small village" },
      ctx,
    );
    expect(result.success).toBe(true);

    const updated = await db.locations.get(created.data?.id as string);
    expect(updated?.description).toBe("A small village");
  });
});

describe("timeline event tools", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.timelineEvents.clear();
  });

  it("create_timeline_event creates an event", async () => {
    const result = await executeTool(
      "create_timeline_event",
      { title: "The Battle", date: "Year 5, Day 3" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe("The Battle");
  });

  it("get_timeline_event returns event details", async () => {
    const created = await executeTool(
      "create_timeline_event",
      { title: "Coronation" },
      ctx,
    );
    const result = await executeTool(
      "get_timeline_event",
      { id: created.data?.id as string },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe("Coronation");
  });

  it("update_timeline_event modifies fields", async () => {
    const created = await executeTool(
      "create_timeline_event",
      { title: "Feast" },
      ctx,
    );
    await executeTool(
      "update_timeline_event",
      { id: created.data?.id as string, description: "A grand feast" },
      ctx,
    );

    const updated = await db.timelineEvents.get(created.data?.id as string);
    expect(updated?.description).toBe("A grand feast");
  });
});

describe("chapter tools", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
  });

  it("create_chapter creates a chapter", async () => {
    const result = await executeTool(
      "create_chapter",
      { title: "Chapter 1", synopsis: "The beginning" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe("Chapter 1");
  });

  it("get_chapter returns chapter details", async () => {
    const created = await executeTool(
      "create_chapter",
      { title: "Chapter 2" },
      ctx,
    );
    const result = await executeTool(
      "get_chapter",
      { id: created.data?.id as string },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe("Chapter 2");
    expect(result.data?.status).toBe("draft");
  });

  it("update_chapter modifies title and status", async () => {
    const created = await executeTool(
      "create_chapter",
      { title: "Draft Chapter" },
      ctx,
    );
    await executeTool(
      "update_chapter",
      {
        id: created.data?.id as string,
        title: "Revised Chapter",
        status: "revised",
      },
      ctx,
    );

    const updated = await db.chapters.get(created.data?.id as string);
    expect(updated?.title).toBe("Revised Chapter");
    expect(updated?.status).toBe("revised");
  });

  it("search_chapters finds matching content", async () => {
    const ch = makeChapter({
      projectId,
      title: "Forest Walk",
      content: "The trees whispered in the dark forest.",
    });
    await db.chapters.add(ch);

    const result = await executeTool(
      "search_chapters",
      { query: "forest" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect((result.data?.matches as { id: string }[]).length).toBe(1);
  });

  it("search_chapters returns empty for no matches", async () => {
    const ch = makeChapter({
      projectId,
      title: "Chapter",
      content: "Nothing here.",
    });
    await db.chapters.add(ch);

    const result = await executeTool(
      "search_chapters",
      { query: "dragon" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect((result.data?.matches as { id: string }[]).length).toBe(0);
  });
});

describe("search_project tool", () => {
  beforeEach(async () => {
    resetIdCounter();
    await Promise.all([
      db.chapters.clear(),
      db.characters.clear(),
      db.locations.clear(),
      db.timelineEvents.clear(),
      db.styleGuideEntries.clear(),
      db.worldbuildingDocs.clear(),
      db.outlineGridColumns.clear(),
      db.outlineGridRows.clear(),
      db.outlineGridCells.clear(),
    ]);
  });

  it("returns matches across entity types", async () => {
    await Promise.all([
      db.chapters.add(
        makeChapter({
          projectId,
          title: "Dragon Chapter",
          content: "The dragon attacked.",
        }),
      ),
      db.characters.add(makeCharacter({ projectId, name: "Dragon Lord" })),
      db.locations.add(makeLocation({ projectId, name: "Dragon Peak" })),
    ]);

    const result = await executeTool(
      "search_project",
      { query: "dragon" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.totalCount).toBe(3);
    const results = result.data?.results as { entityType: string }[];
    const types = results.map((r) => r.entityType);
    expect(types).toContain("chapter");
    expect(types).toContain("character");
    expect(types).toContain("location");
  });

  it("returns empty for no matches", async () => {
    await db.chapters.add(
      makeChapter({ projectId, title: "Chapter", content: "Nothing here." }),
    );

    const result = await executeTool(
      "search_project",
      { query: "dragon" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.totalCount).toBe(0);
    expect((result.data?.results as unknown[]).length).toBe(0);
  });

  it("filters by entity_types", async () => {
    await Promise.all([
      db.chapters.add(
        makeChapter({
          projectId,
          title: "Dragon Chapter",
          content: "The dragon attacked.",
        }),
      ),
      db.characters.add(makeCharacter({ projectId, name: "Dragon Lord" })),
    ]);

    const result = await executeTool(
      "search_project",
      { query: "dragon", entity_types: ["character"] },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.totalCount).toBe(1);
    const results = result.data?.results as { entityType: string }[];
    expect(results[0].entityType).toBe("character");
  });

  it("rejects missing query", async () => {
    const result = await executeTool("search_project", {}, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
  });
});

describe("executeTool with unknown tool", () => {
  it("returns failure for unknown tool ID", async () => {
    const result = await executeTool("nonexistent_tool", {}, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Unknown tool");
  });
});

describe("parameter validation", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.characters.clear();
    await db.chapters.clear();
  });

  it("rejects missing required name on create_character", async () => {
    const result = await executeTool("create_character", {}, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
  });

  it("rejects invalid role enum value on create_character", async () => {
    const result = await executeTool(
      "create_character",
      { name: "Elena", role: "villain" },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
  });

  it("rejects invalid status enum value on update_chapter", async () => {
    const created = await executeTool("create_chapter", { title: "Ch1" }, ctx);
    const result = await executeTool(
      "update_chapter",
      { id: created.data?.id as string, status: "published" },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
  });

  it("rejects missing id on get_character", async () => {
    const result = await executeTool("get_character", {}, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
  });

  it("rejects empty string id on get_character", async () => {
    const result = await executeTool("get_character", { id: "" }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
  });

  it("rejects missing query on search_chapters", async () => {
    const result = await executeTool("search_chapters", {}, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
  });

  it("accepts empty params for list_characters", async () => {
    const result = await executeTool("list_characters", {}, ctx);
    expect(result.success).toBe(true);
  });

  it("strips unknown extra params without rejection", async () => {
    const result = await executeTool(
      "create_character",
      { name: "Elena", unknownField: "should be stripped" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Elena");
  });

  it("error message includes field name and reason", async () => {
    const result = await executeTool("get_character", {}, ctx);
    expect(result.message).toContain("id");
  });

  it("does not modify DB when validation fails", async () => {
    await executeTool("create_character", {}, ctx);
    const chars = await db.characters.where({ projectId }).toArray();
    expect(chars).toHaveLength(0);
  });
});

describe("list/read tools (agentic discovery)", () => {
  beforeEach(async () => {
    resetIdCounter();
    await Promise.all([
      db.chapters.clear(),
      db.locations.clear(),
      db.timelineEvents.clear(),
      db.styleGuideEntries.clear(),
      db.worldbuildingDocs.clear(),
      db.outlineGridColumns.clear(),
      db.outlineGridRows.clear(),
      db.outlineGridCells.clear(),
    ]);
  });

  it("list_chapters returns all chapters", async () => {
    await db.chapters.bulkAdd([
      makeChapter({ projectId, title: "Ch1" }),
      makeChapter({ projectId, title: "Ch2" }),
    ]);
    const result = await executeTool("list_chapters", {}, ctx);
    expect(result.success).toBe(true);
    expect((result.data?.chapters as { id: string }[]).length).toBe(2);
  });

  it("read_chapter returns full content", async () => {
    const ch = makeChapter({
      projectId,
      title: "Intro",
      content: "Once upon a time...",
    });
    await db.chapters.add(ch);
    const result = await executeTool("read_chapter", { id: ch.id }, ctx);
    expect(result.success).toBe(true);
    expect(result.data?.content).toBe("Once upon a time...");
  });

  it("read_chapter fails for unknown ID", async () => {
    const result = await executeTool(
      "read_chapter",
      { id: "nonexistent" },
      ctx,
    );
    expect(result.success).toBe(false);
  });

  it("list_locations returns all locations", async () => {
    await db.locations.bulkAdd([
      makeLocation({ projectId, name: "Forest" }),
      makeLocation({ projectId, name: "Castle" }),
    ]);
    const result = await executeTool("list_locations", {}, ctx);
    expect(result.success).toBe(true);
    expect((result.data?.locations as { id: string }[]).length).toBe(2);
  });

  it("list_timeline_events returns all events", async () => {
    await db.timelineEvents.bulkAdd([
      makeTimelineEvent({ projectId, title: "Battle" }),
      makeTimelineEvent({ projectId, title: "Peace" }),
    ]);
    const result = await executeTool("list_timeline_events", {}, ctx);
    expect(result.success).toBe(true);
    expect((result.data?.events as { id: string }[]).length).toBe(2);
  });

  it("list_style_guide returns all entries", async () => {
    await db.styleGuideEntries.bulkAdd([
      makeStyleGuideEntry({ projectId, title: "POV", content: "First person" }),
    ]);
    const result = await executeTool("list_style_guide", {}, ctx);
    expect(result.success).toBe(true);
    expect((result.data?.entries as { id: string }[]).length).toBe(1);
  });

  it("get_style_guide_entry returns full content", async () => {
    const entry = makeStyleGuideEntry({
      projectId,
      title: "Tense",
      content: "Past tense throughout",
    });
    await db.styleGuideEntries.add(entry);
    const result = await executeTool(
      "get_style_guide_entry",
      { id: entry.id },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.content).toBe("Past tense throughout");
  });

  it("get_style_guide_entry fails for unknown ID", async () => {
    const result = await executeTool(
      "get_style_guide_entry",
      { id: "nonexistent" },
      ctx,
    );
    expect(result.success).toBe(false);
  });

  it("list_worldbuilding_docs returns all docs", async () => {
    await db.worldbuildingDocs.bulkAdd([
      makeWorldbuildingDoc({ projectId, title: "Magic System" }),
      makeWorldbuildingDoc({ projectId, title: "Geography" }),
    ]);
    const result = await executeTool("list_worldbuilding_docs", {}, ctx);
    expect(result.success).toBe(true);
    expect((result.data?.docs as { id: string }[]).length).toBe(2);
  });

  it("get_worldbuilding_doc returns full content", async () => {
    const doc = makeWorldbuildingDoc({
      projectId,
      title: "Lore",
      content: "Ancient history of the realm",
    });
    await db.worldbuildingDocs.add(doc);
    const result = await executeTool(
      "get_worldbuilding_doc",
      { id: doc.id },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.content).toBe("Ancient history of the realm");
  });

  it("get_worldbuilding_doc fails for unknown ID", async () => {
    const result = await executeTool(
      "get_worldbuilding_doc",
      { id: "nonexistent" },
      ctx,
    );
    expect(result.success).toBe(false);
  });

  it("get_outline returns serialized outline", async () => {
    const col = makeOutlineGridColumn({ projectId, title: "Act" });
    const ch = makeChapter({ projectId, title: "Chapter 1" });
    const row = makeOutlineGridRow({
      projectId,
      linkedChapterId: ch.id,
    });
    const cell = makeOutlineGridCell({
      projectId,
      rowId: row.id,
      columnId: col.id,
      content: "Hero departs",
    });
    await Promise.all([
      db.outlineGridColumns.add(col),
      db.outlineGridRows.add(row),
      db.outlineGridCells.add(cell),
      db.chapters.add(ch),
    ]);
    const result = await executeTool("get_outline", {}, ctx);
    expect(result.success).toBe(true);
    expect(result.data?.outline).toContain("Hero departs");
    expect(result.data?.outline).toContain("Act");
  });

  it("get_outline returns message when no outline exists", async () => {
    const result = await executeTool("get_outline", {}, ctx);
    expect(result.success).toBe(true);
    expect(result.message).toContain("No outline");
  });
});

describe("enhanced get_chapter", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
  });

  it("includes totalParagraphs and hasSceneBreaks in response", async () => {
    const ch = makeChapter({
      projectId,
      title: "Test",
      content: "Para one.\n\nPara two.\n\n---\n\nPara three.",
    });
    await db.chapters.add(ch);
    const result = await executeTool("get_chapter", { id: ch.id }, ctx);
    expect(result.success).toBe(true);
    expect(result.data?.totalParagraphs).toBe(4);
    expect(result.data?.hasSceneBreaks).toBe(true);
  });

  it("hasSceneBreaks is false when no breaks", async () => {
    const ch = makeChapter({
      projectId,
      title: "Test",
      content: "Para one.\n\nPara two.",
    });
    await db.chapters.add(ch);
    const result = await executeTool("get_chapter", { id: ch.id }, ctx);
    expect(result.data?.hasSceneBreaks).toBe(false);
    expect(result.data?.totalParagraphs).toBe(2);
  });
});

describe("read_chapter_range", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
  });

  const paragraphs = Array.from(
    { length: 30 },
    (_, i) => `Paragraph ${i + 1}.`,
  );
  const content = paragraphs.join("\n\n");

  it("reads a valid range of paragraphs", async () => {
    const ch = makeChapter({ projectId, title: "Long", content });
    await db.chapters.add(ch);
    const result = await executeTool(
      "read_chapter_range",
      { id: ch.id, start: 5, end: 10 },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.start).toBe(5);
    expect(result.data?.end).toBe(10);
    expect(result.data?.totalParagraphs).toBe(30);
    expect(result.data?.content as string).toContain("Paragraph 5.");
    expect(result.data?.content as string).toContain("Paragraph 10.");
    expect(result.data?.content as string).not.toContain("Paragraph 4.");
  });

  it("clamps start to valid range", async () => {
    const ch = makeChapter({
      projectId,
      title: "Short",
      content: "One.\n\nTwo.",
    });
    await db.chapters.add(ch);
    const result = await executeTool(
      "read_chapter_range",
      { id: ch.id, start: 100 },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.start).toBe(2);
    expect(result.data?.end).toBe(2);
  });

  it("defaults end to start + 19", async () => {
    const ch = makeChapter({ projectId, title: "Long", content });
    await db.chapters.add(ch);
    const result = await executeTool(
      "read_chapter_range",
      { id: ch.id, start: 1 },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.start).toBe(1);
    expect(result.data?.end).toBe(20);
  });

  it("caps window at 50 paragraphs", async () => {
    const bigContent = Array.from({ length: 100 }, (_, i) => `P${i + 1}`).join(
      "\n\n",
    );
    const ch = makeChapter({ projectId, title: "Big", content: bigContent });
    await db.chapters.add(ch);
    const result = await executeTool(
      "read_chapter_range",
      { id: ch.id, start: 1, end: 100 },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.end).toBe(50);
  });

  it("fails for unknown chapter ID", async () => {
    const result = await executeTool(
      "read_chapter_range",
      { id: "nonexistent", start: 1 },
      ctx,
    );
    expect(result.success).toBe(false);
  });
});

describe("search_chapter", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
  });

  it("finds matches with surrounding context", async () => {
    const ch = makeChapter({
      projectId,
      title: "Test",
      content:
        "The sun rose.\n\nThe dragon appeared.\n\nIt breathed fire.\n\nThe hero fled.",
    });
    await db.chapters.add(ch);
    const result = await executeTool(
      "search_chapter",
      { id: ch.id, query: "dragon" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.totalMatches).toBe(1);
    const matches = result.data?.matches as {
      paragraph: number;
      snippet: string;
    }[];
    expect(matches[0].paragraph).toBe(2);
    // Default context_paragraphs=1, so snippet includes paragraphs 1-3
    expect(matches[0].snippet).toContain("The sun rose.");
    expect(matches[0].snippet).toContain("The dragon appeared.");
    expect(matches[0].snippet).toContain("It breathed fire.");
  });

  it("returns empty matches for no hits", async () => {
    const ch = makeChapter({
      projectId,
      title: "Test",
      content: "Nothing special here.",
    });
    await db.chapters.add(ch);
    const result = await executeTool(
      "search_chapter",
      { id: ch.id, query: "dragon" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.totalMatches).toBe(0);
  });

  it("respects context_paragraphs parameter", async () => {
    const ch = makeChapter({
      projectId,
      title: "Test",
      content: "A.\n\nB.\n\nC.\n\nTarget word.\n\nE.\n\nF.\n\nG.",
    });
    await db.chapters.add(ch);
    const result = await executeTool(
      "search_chapter",
      { id: ch.id, query: "Target", context_paragraphs: 0 },
      ctx,
    );
    const matches = result.data?.matches as {
      paragraph: number;
      snippet: string;
    }[];
    expect(matches[0].snippet).toBe("Target word.");
  });

  it("fails for unknown chapter ID", async () => {
    const result = await executeTool(
      "search_chapter",
      { id: "nonexistent", query: "test" },
      ctx,
    );
    expect(result.success).toBe(false);
  });
});

describe("get_chapter_structure", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
  });

  it("detects scene breaks and returns scenes", async () => {
    const ch = makeChapter({
      projectId,
      title: "Scenes",
      content:
        "Scene one begins.\n\nMore scene one.\n\n---\n\nScene two starts.\n\nMore scene two.",
    });
    await db.chapters.add(ch);
    const result = await executeTool(
      "get_chapter_structure",
      { id: ch.id },
      ctx,
    );
    expect(result.success).toBe(true);
    const scenes = result.data?.scenes as {
      start: number;
      end: number;
      preview: string;
    }[];
    expect(scenes).toHaveLength(2);
    expect(scenes[0]).toEqual({
      start: 1,
      end: 2,
      preview: "Scene one begins.",
    });
    expect(scenes[1]).toEqual({
      start: 4,
      end: 5,
      preview: "Scene two starts.",
    });
    expect(result.data?.totalParagraphs).toBe(5);
  });

  it("returns single scene when no breaks", async () => {
    const ch = makeChapter({
      projectId,
      title: "No Breaks",
      content: "Just one scene.\n\nWith two paragraphs.",
    });
    await db.chapters.add(ch);
    const result = await executeTool(
      "get_chapter_structure",
      { id: ch.id },
      ctx,
    );
    const scenes = result.data?.scenes as {
      start: number;
      end: number;
      preview: string;
    }[];
    expect(scenes).toHaveLength(1);
    expect(scenes[0]).toEqual({ start: 1, end: 2, preview: "Just one scene." });
  });

  it("returns preview truncated to 80 chars", async () => {
    const longPara = "A".repeat(120);
    const ch = makeChapter({
      projectId,
      title: "Long",
      content: longPara,
    });
    await db.chapters.add(ch);
    const result = await executeTool(
      "get_chapter_structure",
      { id: ch.id },
      ctx,
    );
    const scenes = result.data?.scenes as {
      start: number;
      end: number;
      preview: string;
    }[];
    expect(scenes[0].preview).toHaveLength(80);
  });

  it("fails for unknown chapter ID", async () => {
    const result = await executeTool(
      "get_chapter_structure",
      { id: "nonexistent" },
      ctx,
    );
    expect(result.success).toBe(false);
  });
});

describe("requiresApproval", () => {
  it("read tools do not require approval", () => {
    const readTools = [
      "get_character",
      "get_location",
      "get_timeline_event",
      "get_chapter",
      "search_chapters",
      "search_project",
      "list_characters",
      "list_chapters",
      "read_chapter",
      "read_chapter_range",
      "search_chapter",
      "get_chapter_structure",
      "list_locations",
      "list_timeline_events",
      "list_style_guide",
      "get_style_guide_entry",
      "list_worldbuilding_docs",
      "get_worldbuilding_doc",
      "get_outline",
    ];
    for (const id of readTools) {
      expect(AI_TOOL_MAP.get(id)?.requiresApproval).toBe(false);
    }
  });

  it("write tools require approval", () => {
    const writeTools = [
      "create_character",
      "update_character",
      "create_location",
      "update_location",
      "create_timeline_event",
      "update_timeline_event",
      "create_chapter",
      "update_chapter",
    ];
    for (const id of writeTools) {
      expect(AI_TOOL_MAP.get(id)?.requiresApproval).toBe(true);
    }
  });
});
