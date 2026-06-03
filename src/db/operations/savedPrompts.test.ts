import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../database";
import type { ProjectId } from "../schemas";
import {
  createSavedPrompt,
  deleteSavedPrompt,
  getSavedPrompt,
  listAvailableSavedPrompts,
  updateSavedPrompt,
} from "./savedPrompts";

const projectA = "11111111-1111-4111-8111-111111111111" as ProjectId;
const projectB = "22222222-2222-4222-8222-222222222222" as ProjectId;

function resetTables() {
  return db.savedPrompts.clear();
}

describe("savedPrompts operations", () => {
  beforeEach(async () => {
    await resetTables();
  });

  it("creates a global prompt when no projectId is given", async () => {
    const prompt = await createSavedPrompt({ title: "Global", body: "hi" });
    expect(prompt.projectId).toBeNull();
    expect(prompt.title).toBe("Global");
    expect(prompt.body).toBe("hi");
  });

  it("creates a project-scoped prompt", async () => {
    const prompt = await createSavedPrompt({
      title: "Scoped",
      projectId: projectA,
    });
    expect(prompt.projectId).toBe(projectA);
  });

  it("lists global and current-project prompts, excluding other projects", async () => {
    await createSavedPrompt({ title: "Global" });
    await createSavedPrompt({ title: "For A", projectId: projectA });
    await createSavedPrompt({ title: "For B", projectId: projectB });

    const forA = (await listAvailableSavedPrompts(projectA)).map(
      (p) => p.title,
    );
    expect(forA).toContain("Global");
    expect(forA).toContain("For A");
    expect(forA).not.toContain("For B");
  });

  it("returns only global prompts when there is no active project", async () => {
    await createSavedPrompt({ title: "Global" });
    await createSavedPrompt({ title: "For A", projectId: projectA });

    const forNone = (await listAvailableSavedPrompts(null)).map((p) => p.title);
    expect(forNone).toEqual(["Global"]);
  });

  it("sorts by most-recently updated first", async () => {
    const older = await createSavedPrompt({ title: "Older" });
    await new Promise((r) => setTimeout(r, 5));
    const newer = await createSavedPrompt({ title: "Newer" });

    const titles = (await listAvailableSavedPrompts(null)).map((p) => p.title);
    expect(titles).toEqual(["Newer", "Older"]);
    expect(newer.updatedAt >= older.updatedAt).toBe(true);
  });

  it("updates fields (including scope) and bumps updatedAt", async () => {
    const prompt = await createSavedPrompt({ title: "Before" });
    await new Promise((r) => setTimeout(r, 5));
    await updateSavedPrompt(prompt.id, {
      title: "After",
      projectId: projectA,
    });
    const updated = await getSavedPrompt(prompt.id);
    expect(updated?.title).toBe("After");
    expect(updated?.projectId).toBe(projectA);
    expect((updated?.updatedAt ?? "") >= prompt.updatedAt).toBe(true);
  });

  it("deletes a prompt", async () => {
    const prompt = await createSavedPrompt({ title: "X" });
    await deleteSavedPrompt(prompt.id);
    expect(await getSavedPrompt(prompt.id)).toBeUndefined();
  });
});
