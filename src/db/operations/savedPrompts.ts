import { db } from "../database";
import {
  type ProjectId,
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

export async function getSavedPrompt(
  id: SavedPromptId,
): Promise<SavedPrompt | undefined> {
  return db.savedPrompts.get(id);
}

/**
 * Prompts available in a given project context: all global prompts
 * (projectId=null) plus those scoped to `projectId`. Sorted most-recently
 * updated first. Mirrors the global-or-this-project filter used for agents
 * (`listAgents` / `useChatAgents`).
 */
export async function listAvailableSavedPrompts(
  projectId: ProjectId | null,
): Promise<SavedPrompt[]> {
  const all = await db.savedPrompts.toArray();
  return all
    .filter(
      (p) =>
        p.projectId === null ||
        (projectId !== null && p.projectId === projectId),
    )
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
  // Built-in prompts are not user-deletable. The SavedPromptsManager UI gates
  // the delete button by `builtinKey`; this is a defense-in-depth check.
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
 * Idempotently create the built-in saved-prompt rows if they're missing, keyed
 * by `builtinKey`. Called on app boot so a freshly-installed user (or one whose
 * built-in went missing) gets the bundled prompts. Edits to an existing
 * built-in are preserved (only absent keys are seeded); use
 * `resetSavedPromptToDefault` to revert one. Mirrors `seedBuiltinAgents`.
 */
export async function seedBuiltinPrompts(): Promise<void> {
  const { BUILTIN_SAVED_PROMPTS } = await import("@/lib/savedPrompts/builtins");
  const existing = await db.savedPrompts.toArray();
  const presentKeys = new Set(
    existing.map((p) => p.builtinKey).filter((k): k is string => k !== null),
  );

  const timestamp = now();
  for (const [builtinKey, def] of Object.entries(BUILTIN_SAVED_PROMPTS)) {
    if (presentKeys.has(builtinKey)) continue;
    await db.savedPrompts.add(
      SavedPromptSchema.parse({
        id: generateId(),
        projectId: null,
        title: def.title,
        body: def.body,
        builtinKey,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );
  }
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
