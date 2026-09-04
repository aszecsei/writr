"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { listAvailableSavedPrompts } from "@/db/operations/savedPrompts";
import type { ProjectId, SavedPrompt } from "@/db/schemas";

/**
 * Saved prompts available in a project context: all global prompts
 * (projectId=null) plus those scoped to `projectId`, most-recently updated
 * first. The project-list factory only matches an exact projectId, so it
 * can't include globals — hence this custom query.
 */
export function useAvailableSavedPrompts(
  projectId: ProjectId | null,
): SavedPrompt[] | undefined {
  return useLiveQuery(() => listAvailableSavedPrompts(projectId), [projectId]);
}
