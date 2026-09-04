import { beforeEach, describe, expect, it } from "vitest";
import { BUILTIN_SAVED_PROMPTS } from "@/lib/savedPrompts/builtins";
import { db } from "../database";
import type { ProjectId, SavedPrompt, SavedPromptId } from "../schemas";
import {
  createSavedPrompt,
  deleteSavedPrompt,
  resetSavedPromptToDefault,
  updateSavedPrompt,
} from "./savedPrompts";

async function seedBuiltins(): Promise<void> {
  const timestamp = new Date().toISOString();
  for (const [builtinKey, def] of Object.entries(BUILTIN_SAVED_PROMPTS)) {
    await db.savedPrompts.add({
      id: crypto.randomUUID() as SavedPromptId,
      projectId: null,
      title: def.title,
      body: def.body,
      builtinKey,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
}

const projectA = "11111111-1111-4111-8111-111111111111" as ProjectId;

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

  it("updates fields (including scope) and bumps updatedAt", async () => {
    const prompt = await createSavedPrompt({ title: "Before" });
    await new Promise((r) => setTimeout(r, 5));
    await updateSavedPrompt(prompt.id, {
      title: "After",
      projectId: projectA,
    });
    const updated = await db.savedPrompts.get(prompt.id);
    expect(updated?.title).toBe("After");
    expect(updated?.projectId).toBe(projectA);
    expect((updated?.updatedAt ?? "") >= prompt.updatedAt).toBe(true);
  });

  it("deletes a prompt", async () => {
    const prompt = await createSavedPrompt({ title: "X" });
    await deleteSavedPrompt(prompt.id);
    expect(await db.savedPrompts.get(prompt.id)).toBeUndefined();
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
    await seedBuiltins();
    const builtin = await firstBuiltin();
    await expect(deleteSavedPrompt(builtin.id)).rejects.toThrow(/built-in/i);
    expect(await db.savedPrompts.get(builtin.id)).toBeDefined();
  });

  it("resets a built-in prompt to its bundled default", async () => {
    await seedBuiltins();
    const builtin = await firstBuiltin();
    await updateSavedPrompt(builtin.id, {
      title: "Edited title",
      body: "Edited body",
    });

    await resetSavedPromptToDefault(builtin.id);

    const restored = await db.savedPrompts.get(builtin.id);
    const def = BUILTIN_SAVED_PROMPTS[builtin.builtinKey];
    expect(restored?.title).toBe(def.title);
    expect(restored?.body).toBe(def.body);
  });

  it("reset is a no-op for user-created prompts", async () => {
    const prompt = await createSavedPrompt({ title: "Mine", body: "keep" });
    await resetSavedPromptToDefault(prompt.id);
    const after = await db.savedPrompts.get(prompt.id);
    expect(after?.title).toBe("Mine");
    expect(after?.body).toBe("keep");
  });
});
