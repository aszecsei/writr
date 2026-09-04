import { db } from "../database";
import {
  type ChapterId,
  type OutlineGridCell,
  OutlineGridCellSchema,
  type OutlineGridColumn,
  type OutlineGridColumnId,
  OutlineGridColumnSchema,
  type OutlineGridRow,
  type OutlineGridRowId,
  OutlineGridRowSchema,
  type ProjectId,
} from "../schemas";
import {
  compact,
  generateId,
  nextOrder,
  now,
  reorderEntities,
  stripUndefined,
} from "./helpers";

// ─── Shared helper ──────────────────────────────────────────────────

async function shiftOrdersUp<I extends string>(
  entities: { id: I; order: number }[],
  updateFn: (id: I, order: number) => Promise<unknown>,
): Promise<void> {
  for (const entity of entities) {
    await updateFn(entity.id, entity.order + 1);
  }
}

// ─── Outline Grid Columns ────────────────────────────────────────────

export async function getOutlineGridColumnsByProject(
  projectId: ProjectId,
): Promise<OutlineGridColumn[]> {
  return db.outlineGridColumns.where({ projectId }).sortBy("order");
}

export async function createOutlineGridColumn(
  data: Pick<OutlineGridColumn, "projectId" | "title"> &
    Partial<Pick<OutlineGridColumn, "order" | "width">>,
): Promise<OutlineGridColumn> {
  const order = await nextOrder(
    db.outlineGridColumns,
    { projectId: data.projectId },
    data.order,
  );
  const column = OutlineGridColumnSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    title: data.title,
    order,
    width: data.width ?? 200,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.outlineGridColumns.add(column);
  return column;
}

export async function updateOutlineGridColumn(
  id: OutlineGridColumnId,
  data: Partial<Pick<OutlineGridColumn, "title" | "width">>,
): Promise<void> {
  await db.outlineGridColumns.update(id, {
    ...stripUndefined(data),
    updatedAt: now(),
  });
}

export async function deleteOutlineGridColumn(
  id: OutlineGridColumnId,
): Promise<void> {
  await db.transaction(
    "rw",
    [db.outlineGridColumns, db.outlineGridCells],
    async () => {
      await db.outlineGridCells.where({ columnId: id }).delete();
      await db.outlineGridColumns.delete(id);
    },
  );
}

export async function insertOutlineGridColumnAt(
  projectId: ProjectId,
  title: string,
  atOrder: number,
): Promise<OutlineGridColumn> {
  return db.transaction("rw", db.outlineGridColumns, async () => {
    const toShift = await db.outlineGridColumns
      .where({ projectId })
      .filter((c) => c.order >= atOrder)
      .toArray();
    await shiftOrdersUp(toShift, (id, order) =>
      db.outlineGridColumns.update(id, { order }),
    );
    const column = OutlineGridColumnSchema.parse({
      id: generateId(),
      projectId,
      title,
      order: atOrder,
      width: 200,
      createdAt: now(),
      updatedAt: now(),
    });
    await db.outlineGridColumns.add(column);
    return column;
  });
}

export async function reorderOutlineGridColumns(
  orderedIds: OutlineGridColumnId[],
): Promise<void> {
  return reorderEntities(db.outlineGridColumns, orderedIds);
}

// ─── Outline Grid Rows ───────────────────────────────────────────────

export async function getOutlineGridRowsByProject(
  projectId: ProjectId,
): Promise<OutlineGridRow[]> {
  return db.outlineGridRows.where({ projectId }).sortBy("order");
}

export async function createOutlineGridRow(
  data: Pick<OutlineGridRow, "projectId"> &
    Partial<Pick<OutlineGridRow, "linkedChapterId" | "label" | "order">>,
): Promise<OutlineGridRow> {
  const order = await nextOrder(
    db.outlineGridRows,
    { projectId: data.projectId },
    data.order,
  );
  const row = OutlineGridRowSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    linkedChapterId: data.linkedChapterId ?? null,
    label: data.label ?? "",
    order,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.outlineGridRows.add(row);
  return row;
}

export async function updateOutlineGridRow(
  id: OutlineGridRowId,
  data: Partial<Pick<OutlineGridRow, "linkedChapterId" | "label">>,
): Promise<void> {
  await db.outlineGridRows.update(id, {
    ...stripUndefined(data),
    updatedAt: now(),
  });
}

export async function deleteOutlineGridRow(
  id: OutlineGridRowId,
): Promise<void> {
  await db.transaction(
    "rw",
    [db.outlineGridRows, db.outlineGridCells],
    async () => {
      const row = await db.outlineGridRows.get(id);
      if (!row) return;
      await db.outlineGridCells.where({ rowId: id }).delete();
      await db.outlineGridRows.delete(id);
      const remaining = await db.outlineGridRows
        .where({ projectId: row.projectId })
        .sortBy("order");
      await compact(db.outlineGridRows, remaining);
    },
  );
}

export async function insertOutlineGridRowAt(
  projectId: ProjectId,
  atOrder: number,
  label = "",
  linkedChapterId: ChapterId | null = null,
): Promise<OutlineGridRow> {
  return db.transaction("rw", db.outlineGridRows, async () => {
    const toShift = await db.outlineGridRows
      .where({ projectId })
      .filter((r) => r.order >= atOrder)
      .toArray();
    await shiftOrdersUp(toShift, (id, order) =>
      db.outlineGridRows.update(id, { order }),
    );
    const row = OutlineGridRowSchema.parse({
      id: generateId(),
      projectId,
      linkedChapterId,
      label,
      order: atOrder,
      createdAt: now(),
      updatedAt: now(),
    });
    await db.outlineGridRows.add(row);
    return row;
  });
}

export async function reorderOutlineGridRows(
  orderedIds: OutlineGridRowId[],
): Promise<void> {
  return reorderEntities(db.outlineGridRows, orderedIds);
}

// ─── Outline Grid Cells ──────────────────────────────────────────────

export async function getOutlineGridCellsByProject(
  projectId: ProjectId,
): Promise<OutlineGridCell[]> {
  return db.outlineGridCells.where({ projectId }).toArray();
}

export async function getOutlineGridCell(
  rowId: OutlineGridRowId,
  columnId: OutlineGridColumnId,
): Promise<OutlineGridCell | undefined> {
  return db.outlineGridCells
    .where("[rowId+columnId]")
    .equals([rowId, columnId])
    .first();
}

export async function upsertOutlineGridCell(
  data: Pick<OutlineGridCell, "projectId" | "rowId" | "columnId"> &
    Partial<Pick<OutlineGridCell, "content" | "color">>,
): Promise<OutlineGridCell> {
  const existing = await getOutlineGridCell(data.rowId, data.columnId);
  if (existing) {
    await db.outlineGridCells.update(existing.id, {
      content: data.content ?? existing.content,
      color: data.color ?? existing.color,
      updatedAt: now(),
    });
    return { ...existing, ...data, updatedAt: now() };
  }
  const cell = OutlineGridCellSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    rowId: data.rowId,
    columnId: data.columnId,
    content: data.content ?? "",
    color: data.color ?? "white",
    createdAt: now(),
    updatedAt: now(),
  });
  await db.outlineGridCells.add(cell);
  return cell;
}

export async function updateOutlineGridCellColor(
  rowId: OutlineGridRowId,
  columnId: OutlineGridColumnId,
  color: OutlineGridCell["color"],
): Promise<void> {
  const existing = await getOutlineGridCell(rowId, columnId);
  if (existing) {
    await db.outlineGridCells.update(existing.id, { color, updatedAt: now() });
  }
}
