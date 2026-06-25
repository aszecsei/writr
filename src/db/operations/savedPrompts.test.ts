import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { BUILTIN_SAVED_PROMPTS } from "@/lib/savedPrompts/builtins";
import { db } from "../database";
import type { ProjectId, SavedPrompt } from "../schemas";
import {
  createSavedPrompt,
  deleteSavedPrompt,
  getSavedPrompt,
  listAvailableSavedPrompts,
  resetSavedPromptToDefault,
  seedBuiltinPrompts,
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

  it("creates user prompts with a null builtinKey", async () => {
    const prompt = await createSavedPrompt({ title: "User" });
    expect(prompt.builtinKey).toBeNull();
  });
});

describe("built-in saved prompts", () => {
  beforeEach(async () => {
    await resetTables();
  });

  it("seeds each built-in exactly once, idempotently", async () => {
    await seedBuiltinPrompts();
    await seedBuiltinPrompts();

    const all = await db.savedPrompts.toArray();
    const builtinKeys = Object.keys(BUILTIN_SAVED_PROMPTS);
    expect(all).toHaveLength(builtinKeys.length);
    for (const key of builtinKeys) {
      const rows = all.filter((p) => p.builtinKey === key);
      expect(rows).toHaveLength(1);
      expect(rows[0].projectId).toBeNull();
      expect(rows[0].title).toBe(BUILTIN_SAVED_PROMPTS[key].title);
      expect(rows[0].body).toBe(BUILTIN_SAVED_PROMPTS[key].body);
    }
  });

  async function firstBuiltin(): Promise<SavedPrompt & { builtinKey: string }> {
    const builtin = (await db.savedPrompts.toArray()).find(
      (p) => p.builtinKey !== null,
    );
    if (!builtin || builtin.builtinKey === null) {
      throw new Error("expected a built-in prompt to be seeded");
    }
    return builtin as SavedPrompt & { builtinKey: string };
  }

  it("refuses to delete a built-in prompt", async () => {
    await seedBuiltinPrompts();
    const builtin = await firstBuiltin();
    await expect(deleteSavedPrompt(builtin.id)).rejects.toThrow(/built-in/i);
    expect(await getSavedPrompt(builtin.id)).toBeDefined();
  });

  it("resets a built-in prompt to its bundled default", async () => {
    await seedBuiltinPrompts();
    const builtin = await firstBuiltin();
    await updateSavedPrompt(builtin.id, {
      title: "Edited title",
      body: "Edited body",
    });

    await resetSavedPromptToDefault(builtin.id);

    const restored = await getSavedPrompt(builtin.id);
    const def = BUILTIN_SAVED_PROMPTS[builtin.builtinKey];
    expect(restored?.title).toBe(def.title);
    expect(restored?.body).toBe(def.body);
  });

  it("reset is a no-op for user-created prompts", async () => {
    const prompt = await createSavedPrompt({ title: "Mine", body: "keep" });
    await resetSavedPromptToDefault(prompt.id);
    const after = await getSavedPrompt(prompt.id);
    expect(after?.title).toBe("Mine");
    expect(after?.body).toBe("keep");
  });
});
