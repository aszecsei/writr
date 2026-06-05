"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import {
  getBinderItems,
  getManuscriptChaptersOrdered,
} from "@/db/operations/chapters";
import type { Chapter, ChapterSection, ProjectId } from "@/db/schemas";
import { type BinderNode, buildTree } from "@/lib/binder/tree";
import { createEntityHook, createProjectListHook } from "../factories";

export const useChapter = createEntityHook(db.chapters);

/**
 * All chapter rows for a project (every kind/section), sorted by sibling order.
 * Returns separators and scratchpad documents too — for a manuscript-only view
 * (word count, AI context, choosers), use {@link useManuscriptChapters}.
 */
export const useChaptersByProject = createProjectListHook(db.chapters, "order");

/**
 * Manuscript documents in flattened reading order (parent before children),
 * separators and scratchpad excluded. The correct list for AI context, the
 * manuscript word count, and any "pick a chapter" UI.
 */
export function useManuscriptChapters(
  projectId: string | null,
): Chapter[] | undefined {
  return useLiveQuery(
    () =>
      projectId
        ? getManuscriptChaptersOrdered(projectId as ProjectId)
        : Promise.resolve([]),
    [projectId],
  );
}

/**
 * Live binder tree for one section of a project. Re-runs whenever any chapter
 * row changes; tree assembly is a pure transform over the live query result.
 */
export function useBinderTree(
  projectId: string | null,
  section: ChapterSection,
): BinderNode[] {
  return useLiveQuery(
    async () => {
      if (!projectId) return [];
      const items = await getBinderItems(projectId as ProjectId, section);
      return buildTree(items, section);
    },
    [projectId, section],
    [] as BinderNode[],
  );
}
