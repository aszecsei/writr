"use client";

import { db } from "@/db/database";
import { createEntityHook, createProjectListHook } from "../factories";

export const useChapter = createEntityHook(db.chapters);
export const useChaptersByProject = createProjectListHook(db.chapters, "order");
