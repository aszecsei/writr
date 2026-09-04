"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { createEntityHook } from "../factories";

export const useProject = createEntityHook(db.projects);

export function useAllProjects() {
  return useLiveQuery(() =>
    db.projects.orderBy("updatedAt").reverse().toArray(),
  );
}
