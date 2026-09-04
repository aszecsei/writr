import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { LocationId, ProjectId } from "@/db/schemas";
import { makeLocation, resetIdCounter } from "@/test/helpers";
import { executeTool } from "../tools";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const ctx = { projectId };

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
