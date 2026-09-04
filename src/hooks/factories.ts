"use client";

import type { EntityTable } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";

type HasId = { id: string };

export function createProjectListHook<T extends HasId>(
  table: EntityTable<T, "id">,
  sortField: keyof T & string,
) {
  return function useProjectList(projectId: string | null) {
    return useLiveQuery(
      () => (projectId ? table.where({ projectId }).sortBy(sortField) : []),
      [projectId],
    );
  };
}

export function createProjectListUnsortedHook<T extends HasId>(
  table: EntityTable<T, "id">,
) {
  return function useProjectListUnsorted(projectId: string | null) {
    return useLiveQuery(
      () => (projectId ? table.where({ projectId }).toArray() : []),
      [projectId],
    );
  };
}

export function createEntityHook<T extends HasId>(table: EntityTable<T, "id">) {
  return function useEntity(id: T["id"] | null) {
    return useLiveQuery(
      () => (id ? table.where({ id }).first() : undefined),
      [id],
    );
  };
}

/**
 * List hook scoped to a parent field other than `projectId` (e.g. a
 * chapter's snapshots, comments, or scenes). `reverse` flips the sort
 * direction, matching `Collection#reverse().sortBy()` semantics.
 */
export function createChildListHook<
  T extends HasId,
  P extends keyof T & string,
>(
  table: EntityTable<T, "id">,
  parentField: P,
  sortField: keyof T & string,
  options?: { reverse?: boolean },
) {
  return function useChildList(parentId: T[P] | null) {
    return useLiveQuery(() => {
      if (!parentId) return [];
      const collection = table.where({ [parentField]: parentId });
      return options?.reverse
        ? collection.reverse().sortBy(sortField)
        : collection.sortBy(sortField);
    }, [parentId]);
  };
}
