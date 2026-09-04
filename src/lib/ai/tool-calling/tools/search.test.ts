import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { ProjectId } from "@/db/schemas";
import {
  makeChapter,
  makeCharacter,
  makeLocation,
  resetIdCounter,
} from "@/test/helpers";
import { executeTool } from "../tools";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const ctx = { projectId };

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

  it("returns matches across entity types; empty for a term nothing matches", async () => {
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

    const empty = await executeTool(
      "search_project",
      { query: "unicorn" },
      ctx,
    );
    expect(empty.success).toBe(true);
    expect(empty.data?.totalCount).toBe(0);
    expect(empty.data?.results as unknown[]).toHaveLength(0);
  });

  it("filters by entityTypes", async () => {
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
      { query: "dragon", entityTypes: ["character"] },
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
