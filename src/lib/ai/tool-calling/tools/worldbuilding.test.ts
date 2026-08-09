import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { ProjectId, WorldbuildingDocId } from "@/db/schemas";
import { BUILTIN_AGENT_DEFAULTS } from "@/lib/ai/agents/builtins/defaults";
import { makeWorldbuildingDoc, resetIdCounter } from "@/test/helpers";
import { AI_TOOL_MAP, executeTool } from "../tools";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const ctx = { projectId };

describe("worldbuilding doc tools", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.worldbuildingDocs.clear();
  });

  it("create_worldbuilding_doc creates a doc and round-trips via get", async () => {
    const result = await executeTool(
      "create_worldbuilding_doc",
      {
        title: "The Weave",
        content: "Magic flows through the Weave.",
        tags: ["magic"],
      },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe("The Weave");

    const id = result.data?.id as WorldbuildingDocId;
    const fetched = await executeTool(
      "get",
      { requests: [{ category: "worldbuilding", ids: [id] }] },
      ctx,
    );
    const results = fetched.data?.results as {
      found: boolean;
      data?: { content?: string };
    }[];
    const entry = results[0];
    expect(entry.found).toBe(true);
    expect(entry.data?.content).toBe("Magic flows through the Weave.");
  });

  it("update_worldbuilding_doc changes only the provided fields", async () => {
    const doc = makeWorldbuildingDoc({
      projectId,
      title: "Factions",
      content: "original",
      tags: ["politics"],
    });
    await db.worldbuildingDocs.add(doc);

    const result = await executeTool(
      "update_worldbuilding_doc",
      { id: doc.id, content: "revised" },
      ctx,
    );
    expect(result.success).toBe(true);

    const updated = await db.worldbuildingDocs.get(doc.id);
    expect(updated?.content).toBe("revised");
    // Untouched fields are preserved.
    expect(updated?.title).toBe("Factions");
    expect(updated?.tags).toEqual(["politics"]);
  });

  it("update_worldbuilding_doc can move a doc to the top level with parentDocId null", async () => {
    const parent = makeWorldbuildingDoc({ projectId, title: "Geography" });
    const child = makeWorldbuildingDoc({
      projectId,
      title: "The North",
      parentDocId: parent.id,
    });
    await db.worldbuildingDocs.bulkAdd([parent, child]);

    const result = await executeTool(
      "update_worldbuilding_doc",
      { id: child.id, parentDocId: null },
      ctx,
    );
    expect(result.success).toBe(true);

    const updated = await db.worldbuildingDocs.get(child.id);
    expect(updated?.parentDocId).toBeNull();
  });

  it("update_worldbuilding_doc fails for an unknown id", async () => {
    const result = await executeTool(
      "update_worldbuilding_doc",
      { id: "00000000-0000-4000-8000-deadbeefdead", title: "Nope" },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it("update_worldbuilding_doc surfaces the parent-cycle guard as a failure", async () => {
    const root = makeWorldbuildingDoc({ projectId, title: "Root" });
    const child = makeWorldbuildingDoc({
      projectId,
      title: "Child",
      parentDocId: root.id,
    });
    await db.worldbuildingDocs.bulkAdd([root, child]);

    // Moving the root under its own child would create a cycle.
    const result = await executeTool(
      "update_worldbuilding_doc",
      { id: root.id, parentDocId: child.id },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/under one of its own children/i);
  });

  it("delete_worldbuilding_doc removes the doc and re-parents its children", async () => {
    const parent = makeWorldbuildingDoc({ projectId, title: "Cultures" });
    const child = makeWorldbuildingDoc({
      projectId,
      title: "Seafarers",
      parentDocId: parent.id,
    });
    await db.worldbuildingDocs.bulkAdd([parent, child]);

    const result = await executeTool(
      "delete_worldbuilding_doc",
      { id: parent.id },
      ctx,
    );
    expect(result.success).toBe(true);

    expect(await db.worldbuildingDocs.get(parent.id)).toBeUndefined();
    const survivor = await db.worldbuildingDocs.get(child.id);
    // Child re-parents to the deleted doc's parent (null here), not deleted.
    expect(survivor).toBeDefined();
    expect(survivor?.parentDocId).toBeNull();
  });

  it("move_worldbuilding_doc reorders a doc relative to a sibling", async () => {
    const a = makeWorldbuildingDoc({ projectId, title: "A", order: 0 });
    const b = makeWorldbuildingDoc({ projectId, title: "B", order: 1 });
    const c = makeWorldbuildingDoc({ projectId, title: "C", order: 2 });
    await db.worldbuildingDocs.bulkAdd([a, b, c]);

    // Move A after C → order becomes B, C, A.
    const result = await executeTool(
      "move_worldbuilding_doc",
      { id: a.id, targetId: c.id, position: "after" },
      ctx,
    );
    expect(result.success).toBe(true);

    expect((await db.worldbuildingDocs.get(b.id))?.order).toBe(0);
    expect((await db.worldbuildingDocs.get(c.id))?.order).toBe(1);
    expect((await db.worldbuildingDocs.get(a.id))?.order).toBe(2);
  });

  it("move_worldbuilding_doc only reorders within a parent's siblings", async () => {
    // Two sibling groups: roots [a, b] and children [x, y] under `a`.
    const a = makeWorldbuildingDoc({ projectId, title: "A", order: 0 });
    const b = makeWorldbuildingDoc({ projectId, title: "B", order: 1 });
    const x = makeWorldbuildingDoc({
      projectId,
      title: "X",
      parentDocId: a.id,
      order: 0,
    });
    const y = makeWorldbuildingDoc({
      projectId,
      title: "Y",
      parentDocId: a.id,
      order: 1,
    });
    await db.worldbuildingDocs.bulkAdd([a, b, x, y]);

    // Move Y before X among the children of `a`.
    const result = await executeTool(
      "move_worldbuilding_doc",
      { id: y.id, targetId: x.id, position: "before" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect((await db.worldbuildingDocs.get(y.id))?.order).toBe(0);
    expect((await db.worldbuildingDocs.get(x.id))?.order).toBe(1);
  });

  it("move_worldbuilding_doc rejects a target with a different parent", async () => {
    const root = makeWorldbuildingDoc({ projectId, title: "Root", order: 0 });
    const child = makeWorldbuildingDoc({
      projectId,
      title: "Child",
      parentDocId: root.id,
      order: 0,
    });
    await db.worldbuildingDocs.bulkAdd([root, child]);

    const result = await executeTool(
      "move_worldbuilding_doc",
      { id: child.id, targetId: root.id, position: "after" },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/same parent/i);
  });
});

describe("worldbuilder agent wiring", () => {
  it("the Worldbuilder builtin's allowedToolIds all resolve to registered tools", () => {
    const ids = BUILTIN_AGENT_DEFAULTS.worldbuilder.allowedToolIds;
    expect(ids).toContain("create_worldbuilding_doc");
    for (const id of ids) {
      // Scoped read ids (e.g. "list:character") map to the consolidated
      // list/get tools; everything else must be a registered tool id.
      const base = id.includes(":") ? id.split(":")[0] : id;
      expect(AI_TOOL_MAP.get(base)).toBeDefined();
    }
  });
});
