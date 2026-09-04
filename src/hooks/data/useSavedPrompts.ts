"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
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
  return useLiveQuery(async () => {
    const all = await db.savedPrompts.toArray();
    return all
      .filter(
        (p) =>
          p.projectId === null ||
          (projectId !== null && p.projectId === projectId),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [projectId]);
}
