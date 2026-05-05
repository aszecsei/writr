"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { CustomAgent } from "@/db/schemas";

/**
 * List custom agents available for a project. Includes both project-scoped
 * and global (projectId=null) agents so utility agents can travel across
 * projects without copying.
 */
export function useCustomAgents(
  projectId: string | null,
): CustomAgent[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.customAgents.toArray();
    return all
      .filter(
        (a) =>
          a.projectId === null ||
          (projectId !== null && a.projectId === projectId),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projectId]);
}

export function useCustomAgent(id: string | null): CustomAgent | undefined {
  return useLiveQuery(() => (id ? db.customAgents.get(id) : undefined), [id]);
}
