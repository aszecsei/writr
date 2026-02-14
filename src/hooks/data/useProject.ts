"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";

export function useProject(projectId: string | null) {
  return useLiveQuery(
    () => (projectId ? db.projects.get(projectId) : undefined),
    [projectId],
  );
}

export function useAllProjects() {
  return useLiveQuery(() =>
    db.projects.orderBy("updatedAt").reverse().toArray(),
  );
}
