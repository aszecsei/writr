"use client";

import { db } from "@/db/database";
import { createChildListHook } from "../factories";

export const useSnapshotsByChapter = createChildListHook(
  db.chapterSnapshots,
  "chapterId",
  "createdAt",
  { reverse: true },
);
