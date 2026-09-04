import { db } from "../database";
import {
  type SavedPrompt,
  type SavedPromptId,
  SavedPromptSchema,
} from "../schemas";
import { generateId, now, stripUndefined } from "./helpers";

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

  const { BUILTIN_SAVED_PROMPTS } = await import("@/lib/savedPrompts/builtins");
  const def = BUILTIN_SAVED_PROMPTS[existing.builtinKey];
  if (!def) return;

  await db.savedPrompts.update(id, {
    title: def.title,
    body: def.body,
    updatedAt: now(),
  });
}
