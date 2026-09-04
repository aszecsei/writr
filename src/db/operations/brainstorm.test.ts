import { beforeEach, describe, expect, it } from "vitest";
import { makeBrainstormSetup, resetIdCounter } from "@/test/helpers";
import { db } from "../database";
import type { BrainstormIdeaId } from "../schemas";
import {
  createBrainstormIdea,
  createBrainstormSetup,
  deleteBrainstormSetup,
  getBrainstormSetup,
  listBrainstormIdeas,
  listBrainstormSetups,
} from "./brainstorm";

function resetTables() {
  return Promise.all([db.brainstormSetups.clear(), db.brainstormIdeas.clear()]);
}

describe("brainstorm setup operations", () => {
  beforeEach(async () => {
    resetIdCounter();
    await resetTables();
  });

  it("lists setups most-recently updated first", async () => {
    await db.brainstormSetups.bulkAdd([
      makeBrainstormSetup({
        name: "Older",
        updatedAt: "2024-01-01T00:00:00.000Z",
      }),
      makeBrainstormSetup({
        name: "Newer",
        updatedAt: "2024-01-02T00:00:00.000Z",
      }),
    ]);
    const names = (await listBrainstormSetups()).map((s) => s.name);
    expect(names).toEqual(["Newer", "Older"]);
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
    resetIdCounter();
    await resetTables();
  });

  it("lists ideas most-recently created first", async () => {
    await db.brainstormIdeas.bulkAdd([
      {
        id: crypto.randomUUID() as BrainstormIdeaId,
        setupId: null,
        ideaText: "first",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: crypto.randomUUID() as BrainstormIdeaId,
        setupId: null,
        ideaText: "second",
        createdAt: "2024-01-02T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      },
    ]);
    const texts = (await listBrainstormIdeas()).map((i) => i.ideaText);
    expect(texts).toEqual(["second", "first"]);
  });
});
