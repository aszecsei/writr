"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type {
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow,
} from "@/db/schemas";

export function useOutlineGridColumns(
  projectId: string | null,
): OutlineGridColumn[] | undefined {
  return useLiveQuery(
    () =>
      projectId
        ? db.outlineGridColumns.where({ projectId }).sortBy("order")
        : [],
    [projectId],
  );
}

export function useOutlineGridRows(
  projectId: string | null,
): OutlineGridRow[] | undefined {
  return useLiveQuery(
    () =>
      projectId ? db.outlineGridRows.where({ projectId }).sortBy("order") : [],
    [projectId],
  );
}

export function useOutlineGridCells(
  projectId: string | null,
): OutlineGridCell[] | undefined {
  return useLiveQuery(
    () => (projectId ? db.outlineGridCells.where({ projectId }).toArray() : []),
    [projectId],
  );
}

/** Returns cells indexed by "rowId:columnId" for fast lookup */
export function useOutlineGridCellsMap(
  projectId: string | null,
): Map<string, OutlineGridCell> | undefined {
  const cells = useOutlineGridCells(projectId);
  if (!cells) return undefined;

  const map = new Map<string, OutlineGridCell>();
  for (const cell of cells) {
    map.set(`${cell.rowId}:${cell.columnId}`, cell);
  }
  return map;
}
