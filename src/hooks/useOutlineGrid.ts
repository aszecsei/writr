"use client";

import { db } from "@/db/database";
import type { OutlineGridCell } from "@/db/schemas";
import {
  createProjectListHook,
  createProjectListUnsortedHook,
} from "./factories";

export const useOutlineGridColumns = createProjectListHook(
  db.outlineGridColumns,
  "order",
);

export const useOutlineGridRows = createProjectListHook(
  db.outlineGridRows,
  "order",
);

export const useOutlineGridCells = createProjectListUnsortedHook(
  db.outlineGridCells,
);

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
