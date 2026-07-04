"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { ChapterId, ProjectId, Scene } from "@/db/schemas";
import { createEntityHook } from "../factories";

export const useScene = createEntityHook(db.scenes);

/**
 * A chapter's scenes in order (core scene first). The correct list for the
 * sidebar scene rows and the Details panel scene overview.
 */
export function useScenesByChapter(
  chapterId: string | null,
): Scene[] | undefined {
  return useLiveQuery<Scene[]>(
    () =>
      chapterId
        ? db.scenes.where({ chapterId: chapterId as ChapterId }).sortBy("order")
        : Promise.resolve([]),
    [chapterId],
  );
}

/** Every scene of a project — for aggregate views and strand autocomplete. */
export function useScenesByProject(
  projectId: string | null,
): Scene[] | undefined {
  return useLiveQuery<Scene[]>(
    () =>
      projectId
        ? db.scenes.where({ projectId: projectId as ProjectId }).toArray()
        : Promise.resolve([]),
    [projectId],
  );
}

/**
 * The distinct set of strands used anywhere in a project, sorted — the source
 * for strand autocomplete in the Details panel. Recomputes live as scenes
 * change so a newly typed strand becomes a suggestion elsewhere immediately.
 */
export function useProjectStrands(projectId: string | null): string[] {
  return useLiveQuery(
    async () => {
      if (!projectId) return [];
      const rows = await db.scenes
        .where({ projectId: projectId as ProjectId })
        .toArray();
      return [...new Set(rows.flatMap((s) => s.strands))].sort();
    },
    [projectId],
    [] as string[],
  );
}
