import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { ProjectId } from "@/db/schemas";
import {
  makeChapter,
  makeCharacter,
  makeGuardrailEntry,
  makeLocation,
  makeOutlineGridCell,
  makeOutlineGridColumn,
  makeOutlineGridRow,
  makeStyleGuideEntry,
  makeTimelineEvent,
  makeWorldbuildingDoc,
  resetIdCounter,
} from "@/test/helpers";
import { executeTool } from "../tools";
import { permittedCategories } from "./registry";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const ctx = { projectId };

interface ListEntry {
  id: string;
  name?: string;
  title?: string;
  category?: string;
}

interface GetResult {
  category: string;
  id?: string;
  found: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

describe("list tool", () => {
  beforeEach(async () => {
    resetIdCounter();
    await Promise.all([
      db.chapters.clear(),
      db.characters.clear(),
      db.locations.clear(),
      db.timelineEvents.clear(),
      db.styleGuideEntries.clear(),
      db.guardrailEntries.clear(),
      db.worldbuildingDocs.clear(),
    ]);
  });

  it("lists characters", async () => {
    await db.characters.bulkAdd([
      makeCharacter({ projectId, name: "Alpha" }),
      makeCharacter({ projectId, name: "Beta" }),
    ]);
    const r = await executeTool("list", { category: "character" }, ctx);
    expect(r.success).toBe(true);
    expect(r.data?.category).toBe("character");
    const entries = r.data?.entries as ListEntry[];
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.name).sort()).toEqual(["Alpha", "Beta"]);
  });

  it("lists locations", async () => {
    await db.locations.bulkAdd([
      makeLocation({ projectId, name: "Forest" }),
      makeLocation({ projectId, name: "Castle" }),
    ]);
    const r = await executeTool("list", { category: "location" }, ctx);
    expect(r.success).toBe(true);
    expect((r.data?.entries as ListEntry[]).length).toBe(2);
  });

  it("lists timeline events", async () => {
    await db.timelineEvents.bulkAdd([
      makeTimelineEvent({ projectId, title: "Battle" }),
      makeTimelineEvent({ projectId, title: "Peace" }),
    ]);
    const r = await executeTool("list", { category: "timeline" }, ctx);
    expect(r.success).toBe(true);
    expect((r.data?.entries as ListEntry[]).length).toBe(2);
  });

  it("lists chapters", async () => {
    await db.chapters.bulkAdd([
      makeChapter({ projectId, title: "Ch1", order: 0 }),
      makeChapter({ projectId, title: "Ch2", order: 1 }),
    ]);
    const r = await executeTool("list", { category: "chapter" }, ctx);
    expect(r.success).toBe(true);
    expect((r.data?.entries as ListEntry[]).length).toBe(2);
  });

  it("list chapters honors the readable-chapter set", async () => {
    const ch1 = makeChapter({ projectId, title: "Ch1", order: 0 });
    const ch2 = makeChapter({ projectId, title: "Ch2", order: 1 });
    await db.chapters.bulkAdd([ch1, ch2]);
    const r = await executeTool(
      "list",
      { category: "chapter" },
      { ...ctx, readableChapterIds: new Set([ch1.id]) },
    );
    expect(r.success).toBe(true);
    const entries = r.data?.entries as ListEntry[];
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("Ch1");
  });

  it("lists style guide entries", async () => {
    await db.styleGuideEntries.add(
      makeStyleGuideEntry({ projectId, title: "POV", content: "First" }),
    );
    const r = await executeTool("list", { category: "style_guide" }, ctx);
    expect(r.success).toBe(true);
    expect((r.data?.entries as ListEntry[]).length).toBe(1);
  });

  it("lists guardrails", async () => {
    await db.guardrailEntries.add(
      makeGuardrailEntry({ projectId, label: "No filler" }),
    );
    const r = await executeTool("list", { category: "guardrail" }, ctx);
    expect(r.success).toBe(true);
    expect((r.data?.entries as ListEntry[]).length).toBe(1);
  });

  it("lists worldbuilding docs", async () => {
    await db.worldbuildingDocs.bulkAdd([
      makeWorldbuildingDoc({ projectId, title: "Magic" }),
      makeWorldbuildingDoc({ projectId, title: "Geography" }),
    ]);
    const r = await executeTool("list", { category: "worldbuilding" }, ctx);
    expect(r.success).toBe(true);
    expect((r.data?.entries as ListEntry[]).length).toBe(2);
  });

  it("rejects unknown category", async () => {
    const r = await executeTool("list", { category: "garbage" }, ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain("Invalid parameters");
  });

  it("rejects outline (singleton — has no list)", async () => {
    const r = await executeTool("list", { category: "outline" }, ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain("Invalid parameters");
  });

  it("rejects summary (chapter-keyed — has no list)", async () => {
    const r = await executeTool("list", { category: "summary" }, ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain("Invalid parameters");
  });
});

describe("get tool", () => {
  beforeEach(async () => {
    resetIdCounter();
    await Promise.all([
      db.chapters.clear(),
      db.characters.clear(),
      db.locations.clear(),
      db.timelineEvents.clear(),
      db.styleGuideEntries.clear(),
      db.guardrailEntries.clear(),
      db.worldbuildingDocs.clear(),
      db.outlineGridColumns.clear(),
      db.outlineGridRows.clear(),
      db.outlineGridCells.clear(),
    ]);
  });

  it("fetches a single character", async () => {
    const c = makeCharacter({
      projectId,
      name: "Bob",
      role: "antagonist",
      description: "Sneaky.",
    });
    await db.characters.add(c);
    const r = await executeTool(
      "get",
      { requests: [{ category: "character", ids: [c.id] }] },
      ctx,
    );
    expect(r.success).toBe(true);
    const results = r.data?.results as GetResult[];
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      category: "character",
      id: c.id,
      found: true,
    });
    expect(results[0].data?.name).toBe("Bob");
    expect(results[0].data?.role).toBe("antagonist");
  });

  it("fetches a single guardrail with its flags and fixes", async () => {
    const g = makeGuardrailEntry({
      projectId,
      label: "No filler comparisons",
      flags: ["the way a [comparison]"],
      fix: "Name what is present.",
      positiveFix: "Use the concrete detail.",
    });
    await db.guardrailEntries.add(g);
    const r = await executeTool(
      "get",
      { requests: [{ category: "guardrail", ids: [g.id] }] },
      ctx,
    );
    expect(r.success).toBe(true);
    const results = r.data?.results as GetResult[];
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      category: "guardrail",
      id: g.id,
      found: true,
    });
    expect(results[0].data?.label).toBe("No filler comparisons");
    expect(results[0].data?.flags).toEqual(["the way a [comparison]"]);
    expect(results[0].data?.positiveFix).toBe("Use the concrete detail.");
  });

  it("batches multiple ids in one request", async () => {
    const a = makeCharacter({ projectId, name: "A" });
    const b = makeCharacter({ projectId, name: "B" });
    await db.characters.bulkAdd([a, b]);
    const r = await executeTool(
      "get",
      { requests: [{ category: "character", ids: [a.id, b.id] }] },
      ctx,
    );
    expect(r.success).toBe(true);
    const results = r.data?.results as GetResult[];
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(a.id);
    expect(results[1].id).toBe(b.id);
  });

  it("batches across multiple categories", async () => {
    const c = makeCharacter({ projectId, name: "Hero" });
    const l = makeLocation({ projectId, name: "Cave" });
    await db.characters.add(c);
    await db.locations.add(l);
    const r = await executeTool(
      "get",
      {
        requests: [
          { category: "character", ids: [c.id] },
          { category: "location", ids: [l.id] },
        ],
      },
      ctx,
    );
    expect(r.success).toBe(true);
    const results = r.data?.results as GetResult[];
    expect(results).toHaveLength(2);
    expect(results[0].category).toBe("character");
    expect(results[0].data?.name).toBe("Hero");
    expect(results[1].category).toBe("location");
    expect(results[1].data?.name).toBe("Cave");
  });

  it("returns found:false for missing ids without failing the call", async () => {
    const c = makeCharacter({ projectId, name: "Real" });
    await db.characters.add(c);
    const r = await executeTool(
      "get",
      {
        requests: [{ category: "character", ids: [c.id, "missing-uuid"] }],
      },
      ctx,
    );
    expect(r.success).toBe(true);
    const results = r.data?.results as GetResult[];
    expect(results).toHaveLength(2);
    expect(results[0].found).toBe(true);
    expect(results[1].found).toBe(false);
    expect(results[1].error).toContain("not found");
  });

  it("preserves request order across categories with mixed misses", async () => {
    const c = makeCharacter({ projectId, name: "Hero" });
    await db.characters.add(c);
    const r = await executeTool(
      "get",
      {
        requests: [
          { category: "character", ids: ["missing", c.id] },
          { category: "location", ids: ["also-missing"] },
        ],
      },
      ctx,
    );
    expect(r.success).toBe(true);
    const results = r.data?.results as GetResult[];
    expect(results.map((x) => `${x.category}:${x.id}:${x.found}`)).toEqual([
      `character:missing:false`,
      `character:${c.id}:true`,
      `location:also-missing:false`,
    ]);
  });

  it("get for outline returns the singleton without ids", async () => {
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
    const r = await executeTool(
      "get",
      { requests: [{ category: "outline" }] },
      ctx,
    );
    expect(r.success).toBe(true);
    const results = r.data?.results as GetResult[];
    expect(results).toHaveLength(1);
    expect(results[0].found).toBe(true);
    expect(results[0].data?.outline as string).toContain("Hero departs");
  });

  it("get for outline returns found:true with null outline when grid is empty", async () => {
    const r = await executeTool(
      "get",
      { requests: [{ category: "outline" }] },
      ctx,
    );
    expect(r.success).toBe(true);
    const results = r.data?.results as GetResult[];
    expect(results[0].found).toBe(true);
    expect(results[0].data?.outline).toBeNull();
  });

  it("get for chapter returns metadata", async () => {
    const ch = makeChapter({
      projectId,
      title: "Test",
      content: "Para 1.\n\nPara 2.\n\n---\n\nPara 3.",
    });
    await db.chapters.add(ch);
    const r = await executeTool(
      "get",
      { requests: [{ category: "chapter", ids: [ch.id] }] },
      ctx,
    );
    expect(r.success).toBe(true);
    const results = r.data?.results as GetResult[];
    expect(results[0].data?.totalParagraphs).toBe(4);
    expect(results[0].data?.hasSceneBreaks).toBe(true);
  });

  it("get for chapter respects the readable-chapter set", async () => {
    const ch1 = makeChapter({ projectId, title: "Ch1", order: 0 });
    const ch2 = makeChapter({ projectId, title: "Ch2", order: 1 });
    await db.chapters.bulkAdd([ch1, ch2]);
    const r = await executeTool(
      "get",
      {
        requests: [{ category: "chapter", ids: [ch1.id, ch2.id] }],
      },
      { ...ctx, readableChapterIds: new Set([ch1.id]) },
    );
    expect(r.success).toBe(true);
    const results = r.data?.results as GetResult[];
    expect(results[0].found).toBe(true);
    expect(results[1].found).toBe(false);
    expect(results[1].error).toMatch(/beyond the current reading position/);
  });

  it("rejects empty requests array", async () => {
    const r = await executeTool("get", { requests: [] }, ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain("Invalid parameters");
  });

  it("rejects non-singleton category with no ids", async () => {
    const r = await executeTool(
      "get",
      { requests: [{ category: "character" }] },
      ctx,
    );
    expect(r.success).toBe(true);
    const results = r.data?.results as GetResult[];
    expect(results[0].found).toBe(false);
    expect(results[0].error).toContain("requires at least one id");
  });
});

describe("permittedCategories helper", () => {
  it("returns 'all' when allowedToolIds is undefined", () => {
    expect(permittedCategories("list", undefined)).toBe("all");
  });

  it("returns 'all' when unscoped verb is present", () => {
    expect(permittedCategories("list", ["list", "list:character"])).toBe("all");
    expect(permittedCategories("get", ["get"])).toBe("all");
  });

  it("returns null when verb is absent entirely", () => {
    expect(permittedCategories("list", ["read_chapter"])).toBeNull();
    expect(permittedCategories("get", [])).toBeNull();
  });

  it("returns the set of scoped categories", () => {
    const result = permittedCategories("list", [
      "list:chapter",
      "list:character",
      "read_chapter",
    ]);
    expect(result).toBeInstanceOf(Set);
    if (result instanceof Set) {
      expect(result.has("chapter")).toBe(true);
      expect(result.has("character")).toBe(true);
      expect(result.has("location")).toBe(false);
    }
  });

  it("ignores unknown scoped categories", () => {
    const result = permittedCategories("get", ["get:nonsense", "get:summary"]);
    expect(result).toBeInstanceOf(Set);
    if (result instanceof Set) {
      expect(result.has("summary")).toBe(true);
      expect(result.size).toBe(1);
    }
  });
});
