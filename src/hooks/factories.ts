"use client";

import type { EntityTable } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";

type HasId = { id: string };

export function createProjectListHook<T extends HasId>(
  table: EntityTable<T, "id">,
  sortField: string,
) {
  return function useProjectList(projectId: string | null) {
    return useLiveQuery(
      () =>
        projectId
          ? (table.where({ projectId }).sortBy(sortField) as Promise<T[]>)
          : [],
      [projectId],
    );
  };
}

export function createProjectListUnsortedHook<T extends HasId>(
  table: EntityTable<T, "id">,
) {
  return function useProjectListUnsorted(projectId: string | null) {
    return useLiveQuery(
      () =>
        projectId ? (table.where({ projectId }).toArray() as Promise<T[]>) : [],
      [projectId],
    );
  };
}

export function createEntityHook<T extends HasId>(table: EntityTable<T, "id">) {
  return function useEntity(id: string | null) {
    return useLiveQuery(
      () =>
        id ? (table.get(id as never) as Promise<T | undefined>) : undefined,
      [id],
    );
  };
}
