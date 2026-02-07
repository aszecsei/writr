"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";

export function useSnapshotsByChapter(chapterId: string | null) {
  return useLiveQuery(
    () =>
      chapterId
        ? db.chapterSnapshots.where({ chapterId }).reverse().sortBy("createdAt")
        : [],
    [chapterId],
  );
}
