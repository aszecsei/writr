import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { ProjectId } from "@/db/schemas";
import {
  makeCharacter,
  makeRelationship,
  resetIdCounter,
} from "@/test/helpers";
import { executeTool } from "../tools";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const ctx = { projectId };

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

  it.each([
    ["missing required name", {}],
    ["an invalid role enum value", { name: "Elena", role: "villain" }],
  ])("create_character rejects %s", async (_label, params) => {
    const result = await executeTool("create_character", params, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
    // Validation failure never reaches the DB.
    expect(await db.characters.where({ projectId }).toArray()).toHaveLength(0);
  });
});
