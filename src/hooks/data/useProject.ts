"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Project } from "@/db/schemas";
import { useProjectStore } from "@/store/projectStore";
import { createEntityHook } from "../factories";

export const useProject = createEntityHook(db.projects);

/** The live `Project` row for the project currently open in `projectStore`. */
export function useActiveProject(): Project | undefined {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  return useProject(activeProjectId);
}

export function useAllProjects() {
  return useLiveQuery(() =>
    db.projects.orderBy("updatedAt").reverse().toArray(),
  );
}
