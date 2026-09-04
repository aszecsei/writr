"use client";

import { db } from "@/db/database";
import { createChildListHook } from "../factories";

export const useCommentsByChapter = createChildListHook(
  db.comments,
  "chapterId",
  "fromOffset",
);
