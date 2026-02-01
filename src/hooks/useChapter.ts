"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";

export function useChapter(chapterId: string | null) {
  return useLiveQuery(
    () => (chapterId ? db.chapters.get(chapterId) : undefined),
    [chapterId],
  );
}

export function useChaptersByProject(projectId: string | null) {
  return useLiveQuery(
    () => (projectId ? db.chapters.where({ projectId }).sortBy("order") : []),
    [projectId],
  );
}
