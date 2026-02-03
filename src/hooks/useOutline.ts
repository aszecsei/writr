"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";

export function useOutlineColumnsByProject(projectId: string | null) {
  return useLiveQuery(
    () =>
      projectId ? db.outlineColumns.where({ projectId }).sortBy("order") : [],
    [projectId],
  );
}

export function useOutlineCardsByProject(projectId: string | null) {
  return useLiveQuery(
    () => (projectId ? db.outlineCards.where({ projectId }).toArray() : []),
    [projectId],
  );
}
