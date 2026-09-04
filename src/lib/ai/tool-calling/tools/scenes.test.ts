import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { ProjectId } from "@/db/schemas";
import {
  makeChapter,
  makeCharacter,
  makeLocation,
  makeScene,
  resetIdCounter,
} from "@/test/helpers";
import { executeTool } from "../tools";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const ctx = { projectId };
const unknownId = "00000000-0000-4000-8000-deadbeefdead";

describe("scene tools", () => {
  beforeEach(async () => {
    resetIdCounter();
    await Promise.all([
      db.scenes.clear(),
      db.chapters.clear(),
      db.characters.clear(),
      db.locations.clear(),
    ]);
  });

  it("list_scenes returns ordered scenes with resolved names", async () => {
    const chapter = makeChapter({ projectId, title: "Ch1" });
    await db.chapters.add(chapter);
    const pov = makeCharacter({ projectId, name: "Elena" });
    const bystander = makeCharacter({ projectId, name: "Marek" });
    await db.characters.bulkAdd([pov, bystander]);
    const place = makeLocation({ projectId, name: "The Keep" });
    await db.locations.add(place);

    await db.scenes.bulkAdd([
      makeScene({ projectId, chapterId: chapter.id, order: 0, title: "Core" }),
      makeScene({
        projectId,
        chapterId: chapter.id,
        order: 1,
        title: "Confrontation",
        povCharacterId: pov.id,
        presentCharacterIds: [pov.id, bystander.id],
        locationIds: [place.id],
      }),
    ]);

    const result = await executeTool(
      "list_scenes",
      { chapterId: chapter.id },
      ctx,
    );
    expect(result.success).toBe(true);
    const scenes = result.data?.scenes as Record<string, unknown>[];
    expect(scenes).toHaveLength(2);
    expect(scenes[0]).toMatchObject({ order: 0, title: "Core" });
    expect(scenes[1]).toMatchObject({
      order: 1,
      title: "Confrontation",
      povCharacter: { id: pov.id, name: "Elena" },
      presentCharacters: [
        { id: pov.id, name: "Elena" },
        { id: bystander.id, name: "Marek" },
      ],
      locations: [{ id: place.id, name: "The Keep" }],
    });
  });

  it("update_scene modifies metadata fields", async () => {
    const chapter = makeChapter({ projectId, title: "Ch1" });
    await db.chapters.add(chapter);
    const scene = makeScene({ projectId, chapterId: chapter.id, order: 1 });
    await db.scenes.add(scene);

    const result = await executeTool(
      "update_scene",
      {
        id: scene.id,
        title: "Rising Action",
        status: "revised",
        timelineMode: "flashback",
        strands: ["1943"],
        targetWordCount: 1500,
      },
      ctx,
    );
    expect(result.success).toBe(true);

    const updated = await db.scenes.get(scene.id);
    expect(updated?.title).toBe("Rising Action");
    expect(updated?.status).toBe("revised");
    expect(updated?.timelineMode).toBe("flashback");
    expect(updated?.strands).toEqual(["1943"]);
    expect(updated?.targetWordCount).toBe(1500);
  });

  it("update_scene clears the POV character with null", async () => {
    const chapter = makeChapter({ projectId, title: "Ch1" });
    await db.chapters.add(chapter);
    const pov = makeCharacter({ projectId, name: "Elena" });
    await db.characters.add(pov);
    const scene = makeScene({
      projectId,
      chapterId: chapter.id,
      order: 1,
      povCharacterId: pov.id,
    });
    await db.scenes.add(scene);

    const result = await executeTool(
      "update_scene",
      { id: scene.id, povCharacterId: null },
      ctx,
    );
    expect(result.success).toBe(true);
    expect((await db.scenes.get(scene.id))?.povCharacterId).toBeNull();
  });

  it("update_scene rejects a character id from outside the project", async () => {
    const chapter = makeChapter({ projectId, title: "Ch1" });
    await db.chapters.add(chapter);
    const scene = makeScene({ projectId, chapterId: chapter.id, order: 1 });
    await db.scenes.add(scene);

    const result = await executeTool(
      "update_scene",
      { id: scene.id, povCharacterId: "00000000-0000-4000-8000-deadbeefdead" },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unknown character/i);
    // The scene is left untouched when validation fails.
    expect((await db.scenes.get(scene.id))?.povCharacterId).toBeNull();
  });

  it("update_scene rejects an unknown location id", async () => {
    const chapter = makeChapter({ projectId, title: "Ch1" });
    await db.chapters.add(chapter);
    const scene = makeScene({ projectId, chapterId: chapter.id, order: 1 });
    await db.scenes.add(scene);

    const result = await executeTool(
      "update_scene",
      { id: scene.id, locationIds: ["00000000-0000-4000-8000-deadbeefdead"] },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unknown location/i);
  });

  it.each([
    ["list_scenes", { chapterId: unknownId }],
    ["update_scene", { id: unknownId, title: "x" }],
  ])("%s fails for an unknown id", async (toolId, params) => {
    const result = await executeTool(toolId, params, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });
});
