import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../database";
import {
  createBrainstormIdea,
  createBrainstormSetup,
  deleteBrainstormIdea,
  deleteBrainstormSetup,
  getBrainstormSetup,
  listBrainstormIdeas,
  listBrainstormSetups,
  updateBrainstormSetup,
} from "./brainstorm";

function resetTables() {
  return Promise.all([db.brainstormSetups.clear(), db.brainstormIdeas.clear()]);
}

describe("brainstorm setup operations", () => {
  beforeEach(async () => {
    await resetTables();
  });

  it("creates a setup with defaults", async () => {
    const setup = await createBrainstormSetup({ name: "Fantasy" });
    expect(setup.name).toBe("Fantasy");
    expect(setup.columns).toEqual([]);
    expect(setup.pattern).toBe("");
  });

  it("creates a setup with columns and a pattern", async () => {
    const setup = await createBrainstormSetup({
      name: "Sci-fi",
      columns: [{ name: "tech", options: ["warp", "AI"] }],
      pattern: "A ship with [tech]",
    });
    expect(setup.columns[0].options).toEqual(["warp", "AI"]);
    expect(setup.pattern).toBe("A ship with [tech]");
  });

  it("lists setups most-recently updated first", async () => {
    const older = await createBrainstormSetup({ name: "Older" });
    await new Promise((r) => setTimeout(r, 5));
    await createBrainstormSetup({ name: "Newer" });
    const names = (await listBrainstormSetups()).map((s) => s.name);
    expect(names).toEqual(["Newer", "Older"]);
    expect(older.name).toBe("Older");
  });

  it("updates fields and bumps updatedAt", async () => {
    const setup = await createBrainstormSetup({ name: "Before" });
    await new Promise((r) => setTimeout(r, 5));
    await updateBrainstormSetup(setup.id, {
      name: "After",
      pattern: "[x]",
    });
    const updated = await getBrainstormSetup(setup.id);
    expect(updated?.name).toBe("After");
    expect(updated?.pattern).toBe("[x]");
    expect((updated?.updatedAt ?? "") >= setup.updatedAt).toBe(true);
  });

  it("deletes a setup but keeps its ideas", async () => {
    const setup = await createBrainstormSetup({ name: "Doomed" });
    await createBrainstormIdea({
      setupId: setup.id,
      ideaText: "An idea that should outlive its setup.",
    });
    await deleteBrainstormSetup(setup.id);
    expect(await getBrainstormSetup(setup.id)).toBeUndefined();
    expect(await db.brainstormIdeas.count()).toBe(1);
  });
});

describe("brainstorm idea operations", () => {
  beforeEach(async () => {
    await resetTables();
  });

  it("creates an idea with a null setup by default", async () => {
    const idea = await createBrainstormIdea({ ideaText: "Standalone idea." });
    expect(idea.setupId).toBeNull();
    expect(idea.ideaText).toBe("Standalone idea.");
  });

  it("lists ideas most-recently created first", async () => {
    await createBrainstormIdea({ ideaText: "first" });
    await new Promise((r) => setTimeout(r, 5));
    await createBrainstormIdea({ ideaText: "second" });
    const texts = (await listBrainstormIdeas()).map((i) => i.ideaText);
    expect(texts).toEqual(["second", "first"]);
  });

  it("deletes an idea", async () => {
    const idea = await createBrainstormIdea({ ideaText: "X" });
    await deleteBrainstormIdea(idea.id);
    expect(await db.brainstormIdeas.get(idea.id)).toBeUndefined();
  });
});
