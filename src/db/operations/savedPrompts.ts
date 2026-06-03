import { db } from "../database";
import {
  type ProjectId,
  type SavedPrompt,
  type SavedPromptId,
  SavedPromptSchema,
} from "../schemas";
import { generateId, now } from "./helpers";

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
  await db.savedPrompts.update(id, { ...data, updatedAt: now() });
}

export async function deleteSavedPrompt(id: SavedPromptId): Promise<void> {
  await db.savedPrompts.delete(id);
}
