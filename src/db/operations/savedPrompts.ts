import { BUILTIN_SAVED_PROMPTS } from "@/lib/savedPrompts/builtins";
import { db } from "../database";
import {
  type ProjectId,
  type SavedPrompt,
  type SavedPromptId,
  SavedPromptSchema,
} from "../schemas";
import { generateId, now, stripUndefined } from "./helpers";
import { appliesToProject } from "./scope";

export type CreateSavedPromptInput = {
  title: string;
} & Partial<Pick<SavedPrompt, "body" | "projectId">>;

export async function createSavedPrompt(
  input: CreateSavedPromptInput,
): Promise<SavedPrompt> {
  const timestamp = now();
  const prompt = SavedPromptSchema.parse({
    id: generateId(),
    projectId: input.projectId ?? null,
    title: input.title,
    body: input.body ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.savedPrompts.add(prompt);
  return prompt;
}

/**
 * Saved prompts available in a project context: all global prompts
 * (projectId=null) plus those scoped to `projectId`, most-recently updated
 * first.
 */
export async function listAvailableSavedPrompts(
  projectId: ProjectId | null,
): Promise<SavedPrompt[]> {
  const all = await db.savedPrompts.toArray();
  return all
    .filter((p) => appliesToProject(p, projectId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function updateSavedPrompt(
  id: SavedPromptId,
  data: Partial<Pick<SavedPrompt, "title" | "body" | "projectId">>,
): Promise<void> {
  await db.savedPrompts.update(id, {
    ...stripUndefined(data),
    updatedAt: now(),
  });
}

export async function deleteSavedPrompt(id: SavedPromptId): Promise<void> {
  // Built-in prompts are not user-deletable; this is a defense-in-depth check.
  const existing = await db.savedPrompts.get(id);
  if (!existing) return;
  if (existing.builtinKey !== null) {
    throw new Error(
      `Cannot delete built-in prompt "${existing.builtinKey}". Use resetSavedPromptToDefault instead.`,
    );
  }
  await db.savedPrompts.delete(id);
}

/**
 * Restore a built-in prompt's title/body from the bundled defaults. No-op for
 * user-created prompts (`builtinKey === null`) or unknown keys.
 */
export async function resetSavedPromptToDefault(
  id: SavedPromptId,
): Promise<void> {
  const existing = await db.savedPrompts.get(id);
  if (!existing || existing.builtinKey === null) return;

  const def = BUILTIN_SAVED_PROMPTS[existing.builtinKey];
  if (!def) return;

  await db.savedPrompts.update(id, {
    title: def.title,
    body: def.body,
    updatedAt: now(),
  });
}

/**
 * Idempotent built-in saved-prompt seed (keyed by `builtinKey`). Edits to an
 * existing built-in are preserved; only absent keys are added.
 */
export async function seedBuiltinPrompts(): Promise<void> {
  const timestamp = now();
  const existing = await db.savedPrompts.toArray();
  const presentKeys = new Set(
    existing.map((p) => p.builtinKey).filter((k): k is string => k != null),
  );
  for (const [builtinKey, def] of Object.entries(BUILTIN_SAVED_PROMPTS)) {
    if (presentKeys.has(builtinKey)) continue;
    await db.savedPrompts.add({
      id: generateId() as SavedPromptId,
      projectId: null,
      title: def.title,
      body: def.body,
      builtinKey,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
}
