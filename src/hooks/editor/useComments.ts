"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";

export function useCommentsByChapter(chapterId: string | null) {
  return useLiveQuery(
    () =>
      chapterId ? db.comments.where({ chapterId }).sortBy("fromOffset") : [],
    [chapterId],
  );
}
