import { beforeEach, describe, expect, it } from "vitest";
import {
  makeCharacter,
  makeRelationship,
  resetIdCounter,
} from "@/test/helpers";
import { db } from "../database";
import type { ProjectId } from "../schemas";
import { createRelationship, deleteCharacter } from "./characters";

const projectA = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const projectB = "b1111111-1111-4111-a111-111111111111" as ProjectId;

describe("deleteCharacter", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.characters.clear();
    await db.characterRelationships.clear();
  });

  it("deletes the character record", async () => {
    const char = makeCharacter({ projectId: projectA, name: "Alice" });
    await db.characters.add(char);

    await deleteCharacter(char.id);

    const result = await db.characters.get(char.id);
    expect(result).toBeUndefined();
  });

  it("deletes relationships where character is source", async () => {
    const alice = makeCharacter({ projectId: projectA, name: "Alice" });
    const bob = makeCharacter({ projectId: projectA, name: "Bob" });
    await db.characters.bulkAdd([alice, bob]);

    const rel = makeRelationship({
      projectId: projectA,
      sourceCharacterId: alice.id,
      targetCharacterId: bob.id,
      type: "sibling",
    });
    await db.characterRelationships.add(rel);

    await deleteCharacter(alice.id);

    const remaining = await db.characterRelationships.toArray();
    expect(remaining).toHaveLength(0);
  });

  it("deletes relationships where character is target", async () => {
    const alice = makeCharacter({ projectId: projectA, name: "Alice" });
    const bob = makeCharacter({ projectId: projectA, name: "Bob" });
    await db.characters.bulkAdd([alice, bob]);

    const rel = makeRelationship({
      projectId: projectA,
      sourceCharacterId: bob.id,
      targetCharacterId: alice.id,
      type: "spouse",
    });
    await db.characterRelationships.add(rel);

    await deleteCharacter(alice.id);

    const remaining = await db.characterRelationships.toArray();
    expect(remaining).toHaveLength(0);
  });

  it("deletes relationships in both directions", async () => {
    const alice = makeCharacter({ projectId: projectA, name: "Alice" });
    const bob = makeCharacter({ projectId: projectA, name: "Bob" });
    const carol = makeCharacter({ projectId: projectA, name: "Carol" });
    await db.characters.bulkAdd([alice, bob, carol]);

    const rel1 = makeRelationship({
      projectId: projectA,
      sourceCharacterId: alice.id,
      targetCharacterId: bob.id,
      type: "sibling",
    });
    const rel2 = makeRelationship({
      projectId: projectA,
      sourceCharacterId: carol.id,
      targetCharacterId: alice.id,
      type: "spouse",
    });
    await db.characterRelationships.bulkAdd([rel1, rel2]);

    await deleteCharacter(alice.id);

    const remaining = await db.characterRelationships.toArray();
    expect(remaining).toHaveLength(0);
  });

  it("preserves relationships between other characters", async () => {
    const alice = makeCharacter({ projectId: projectA, name: "Alice" });
    const bob = makeCharacter({ projectId: projectA, name: "Bob" });
    const carol = makeCharacter({ projectId: projectA, name: "Carol" });
    await db.characters.bulkAdd([alice, bob, carol]);

    const relToDelete = makeRelationship({
      projectId: projectA,
      sourceCharacterId: alice.id,
      targetCharacterId: bob.id,
      type: "sibling",
    });
    const relToKeep = makeRelationship({
      projectId: projectA,
      sourceCharacterId: bob.id,
      targetCharacterId: carol.id,
      type: "sibling",
    });
    await db.characterRelationships.bulkAdd([relToDelete, relToKeep]);

    await deleteCharacter(alice.id);

    const remaining = await db.characterRelationships.toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(relToKeep.id);
  });

  it("does not affect characters in other projects", async () => {
    const alice = makeCharacter({ projectId: projectA, name: "Alice" });
    const otherChar = makeCharacter({ projectId: projectB, name: "Other" });
    const otherChar2 = makeCharacter({ projectId: projectB, name: "Other2" });
    await db.characters.bulkAdd([alice, otherChar, otherChar2]);

    const otherRel = makeRelationship({
      projectId: projectB,
      sourceCharacterId: otherChar.id,
      targetCharacterId: otherChar2.id,
      type: "sibling",
    });
    await db.characterRelationships.add(otherRel);

    await deleteCharacter(alice.id);

    const otherCharResult = await db.characters.get(otherChar.id);
    expect(otherCharResult).toBeDefined();

    const otherRels = await db.characterRelationships.toArray();
    expect(otherRels).toHaveLength(1);
  });
});

describe("createRelationship (duplicate & self-ref prevention)", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.characters.clear();
    await db.characterRelationships.clear();
  });

  it("throws on self-relationship", async () => {
    const char = makeCharacter({ projectId: projectA, name: "Solo" });
    await db.characters.add(char);

    await expect(
      createRelationship({
        projectId: projectA,
        sourceCharacterId: char.id,
        targetCharacterId: char.id,
        type: "sibling",
      }),
    ).rejects.toThrow("A character cannot have a relationship with itself.");
  });

  it("throws on exact duplicate (same direction)", async () => {
    const a = makeCharacter({ projectId: projectA, name: "A" });
    const b = makeCharacter({ projectId: projectA, name: "B" });
    await db.characters.bulkAdd([a, b]);

    await createRelationship({
      projectId: projectA,
      sourceCharacterId: a.id,
      targetCharacterId: b.id,
      type: "sibling",
    });

    await expect(
      createRelationship({
        projectId: projectA,
        sourceCharacterId: a.id,
        targetCharacterId: b.id,
        type: "sibling",
      }),
    ).rejects.toThrow("This exact relationship already exists.");
  });

  it("throws on bidirectional duplicate (reversed direction)", async () => {
    const a = makeCharacter({ projectId: projectA, name: "A" });
    const b = makeCharacter({ projectId: projectA, name: "B" });
    await db.characters.bulkAdd([a, b]);

    await createRelationship({
      projectId: projectA,
      sourceCharacterId: a.id,
      targetCharacterId: b.id,
      type: "sibling",
    });

    await expect(
      createRelationship({
        projectId: projectA,
        sourceCharacterId: b.id,
        targetCharacterId: a.id,
        type: "sibling",
      }),
    ).rejects.toThrow("This exact relationship already exists.");
  });

  it("allows same pair with a different type", async () => {
    const a = makeCharacter({ projectId: projectA, name: "A" });
    const b = makeCharacter({ projectId: projectA, name: "B" });
    await db.characters.bulkAdd([a, b]);

    await createRelationship({
      projectId: projectA,
      sourceCharacterId: a.id,
      targetCharacterId: b.id,
      type: "sibling",
    });

    await expect(
      createRelationship({
        projectId: projectA,
        sourceCharacterId: a.id,
        targetCharacterId: b.id,
        type: "spouse",
      }),
    ).resolves.toBeDefined();
  });

  it("allows same pair/type with a different customLabel", async () => {
    const a = makeCharacter({ projectId: projectA, name: "A" });
    const b = makeCharacter({ projectId: projectA, name: "B" });
    await db.characters.bulkAdd([a, b]);

    await createRelationship({
      projectId: projectA,
      sourceCharacterId: a.id,
      targetCharacterId: b.id,
      type: "custom",
      customLabel: "nemesis",
    });

    await expect(
      createRelationship({
        projectId: projectA,
        sourceCharacterId: a.id,
        targetCharacterId: b.id,
        type: "custom",
        customLabel: "rival",
      }),
    ).resolves.toBeDefined();
  });
});
