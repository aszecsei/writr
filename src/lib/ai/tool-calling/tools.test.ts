import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type {
  ChapterId,
  LocationId,
  ProjectId,
  TimelineEventId,
} from "@/db/schemas";
import {
  makeChapter,
  makeCharacter,
  makeLocation,
  makeRelationship,
  makeTimelineEvent,
  resetIdCounter,
} from "@/test/helpers";
import { AI_TOOL_MAP, executeTool, getToolDefinitionsForModel } from "./tools";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const ctx = { projectId };

describe("tool registry", () => {
  it("exports 33 tool definitions", () => {
    expect(getToolDefinitionsForModel()).toHaveLength(33);
  });

  it("has unique tool IDs", () => {
    const defs = getToolDefinitionsForModel();
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers the consolidated list and get tools", () => {
    expect(AI_TOOL_MAP.get("list")).toBeDefined();
    expect(AI_TOOL_MAP.get("get")).toBeDefined();
  });

  it("does not register the obsolete per-entity read tools", () => {
    const removed = [
      "list_characters",
      "list_locations",
      "list_timeline_events",
      "list_chapters",
      "list_style_guide",
      "list_worldbuilding_docs",
      "get_character",
      "get_location",
      "get_timeline_event",
      "get_chapter",
      "get_style_guide_entry",
      "get_worldbuilding_doc",
      "get_outline",
      "read_summary",
    ];
    for (const id of removed) {
      expect(AI_TOOL_MAP.get(id)).toBeUndefined();
    }
  });
});

describe("character tools", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.characters.clear();
    await db.characterRelationships.clear();
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

  it("delete_character removes the character and its relationships", async () => {
    const alice = makeCharacter({ projectId, name: "Alice" });
    const bob = makeCharacter({ projectId, name: "Bob" });
    await db.characters.bulkAdd([alice, bob]);
    await db.characterRelationships.add(
      makeRelationship({
        projectId,
        sourceCharacterId: alice.id,
        targetCharacterId: bob.id,
        type: "sibling",
      }),
    );

    const result = await executeTool("delete_character", { id: alice.id }, ctx);
    expect(result.success).toBe(true);

    expect(await db.characters.get(alice.id)).toBeUndefined();
    // Bob survives; the relationship referencing Alice is gone.
    expect(await db.characters.get(bob.id)).toBeDefined();
    expect(await db.characterRelationships.count()).toBe(0);
  });

  it("delete_character fails for an unknown id", async () => {
    const result = await executeTool(
      "delete_character",
      { id: "00000000-0000-4000-8000-deadbeefdead" },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
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

    const updated = await db.locations.get(created.data?.id as LocationId);
    expect(updated?.description).toBe("A small village");
  });

  it("delete_location removes the location", async () => {
    const loc = makeLocation({ projectId, name: "The Keep" });
    await db.locations.add(loc);

    const result = await executeTool("delete_location", { id: loc.id }, ctx);
    expect(result.success).toBe(true);
    expect(await db.locations.get(loc.id)).toBeUndefined();
  });

  it("delete_location fails for an unknown id", async () => {
    const result = await executeTool(
      "delete_location",
      { id: "00000000-0000-4000-8000-deadbeefdead" },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
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

    const updated = await db.timelineEvents.get(
      created.data?.id as TimelineEventId,
    );
    expect(updated?.description).toBe("A grand feast");
  });

  it("delete_timeline_event removes the event", async () => {
    const event = makeTimelineEvent({ projectId, title: "The Coronation" });
    await db.timelineEvents.add(event);

    const result = await executeTool(
      "delete_timeline_event",
      { id: event.id },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(await db.timelineEvents.get(event.id)).toBeUndefined();
  });

  it("move_timeline_event repositions an event after a target", async () => {
    const a = makeTimelineEvent({ projectId, title: "A", order: 0 });
    const b = makeTimelineEvent({ projectId, title: "B", order: 1 });
    const c = makeTimelineEvent({ projectId, title: "C", order: 2 });
    await db.timelineEvents.bulkAdd([a, b, c]);

    // Move A to sit after C → order becomes B, C, A.
    const result = await executeTool(
      "move_timeline_event",
      { id: a.id, targetId: c.id, position: "after" },
      ctx,
    );
    expect(result.success).toBe(true);

    expect((await db.timelineEvents.get(b.id))?.order).toBe(0);
    expect((await db.timelineEvents.get(c.id))?.order).toBe(1);
    expect((await db.timelineEvents.get(a.id))?.order).toBe(2);
  });

  it("move_timeline_event places an event before a target", async () => {
    const a = makeTimelineEvent({ projectId, title: "A", order: 0 });
    const b = makeTimelineEvent({ projectId, title: "B", order: 1 });
    const c = makeTimelineEvent({ projectId, title: "C", order: 2 });
    await db.timelineEvents.bulkAdd([a, b, c]);

    // Move C before A → order becomes C, A, B.
    await executeTool(
      "move_timeline_event",
      { id: c.id, targetId: a.id, position: "before" },
      ctx,
    );

    expect((await db.timelineEvents.get(c.id))?.order).toBe(0);
    expect((await db.timelineEvents.get(a.id))?.order).toBe(1);
    expect((await db.timelineEvents.get(b.id))?.order).toBe(2);
  });

  it("move_timeline_event fails for an unknown target", async () => {
    const a = makeTimelineEvent({ projectId, title: "A" });
    await db.timelineEvents.add(a);
    const result = await executeTool(
      "move_timeline_event",
      {
        id: a.id,
        targetId: "00000000-0000-4000-8000-deadbeefdead",
        position: "after",
      },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
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

    const updated = await db.chapters.get(created.data?.id as ChapterId);
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

describe("orchestration tools without a delegation host", () => {
  it("delegate fails when context.delegation is absent (e.g. pipeline run)", async () => {
    const result = await executeTool(
      "delegate",
      { agent: "Reader", prompt: "Summarize chapter one." },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/only available in interactive chat/i);
  });

  it("present_choice fails when context.delegation is absent", async () => {
    const result = await executeTool(
      "present_choice",
      { question: "Which ending?", options: ["A", "B"] },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/only available in interactive chat/i);
  });

  it("delegate requires a non-empty agent and prompt", async () => {
    const result = await executeTool(
      "delegate",
      { agent: "", prompt: "" },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
  });

  it("present_choice requires at least two options", async () => {
    const result = await executeTool(
      "present_choice",
      { question: "Pick", options: ["only one"] },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
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

  it("rejects missing query on search_chapters", async () => {
    const result = await executeTool("search_chapters", {}, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
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

  it("does not modify DB when validation fails", async () => {
    await executeTool("create_character", {}, ctx);
    const chars = await db.characters.where({ projectId }).toArray();
    expect(chars).toHaveLength(0);
  });
});

describe("chapter content read tools", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
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
      "list",
      "get",
      "search_chapters",
      "search_project",
      "read_chapter",
      "read_chapter_range",
      "search_chapter",
      "get_chapter_structure",
    ];
    for (const id of readTools) {
      expect(AI_TOOL_MAP.get(id)?.requiresApproval).toBe(false);
    }
  });

  it("write tools require approval", () => {
    const writeTools = [
      "create_character",
      "update_character",
      "delete_character",
      "create_location",
      "update_location",
      "delete_location",
      "create_timeline_event",
      "update_timeline_event",
      "delete_timeline_event",
      "move_timeline_event",
      "create_worldbuilding_doc",
      "update_worldbuilding_doc",
      "delete_worldbuilding_doc",
      "move_worldbuilding_doc",
      "create_chapter",
      "update_chapter",
      "manage_outline_columns",
      "manage_outline_rows",
      "write_outline_cell",
      "set_outline_cell_color",
    ];
    for (const id of writeTools) {
      expect(AI_TOOL_MAP.get(id)?.requiresApproval).toBe(true);
    }
  });
});
