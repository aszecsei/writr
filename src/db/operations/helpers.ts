import type { Table } from "dexie";
import { generateId } from "@/lib/id";
import { db } from "../database";

export { generateId };

/**
 * Return `explicitOrder` if provided, otherwise the next order value
 * (max existing + 1, or 0 if none). Using max+1 instead of count avoids
 * collisions when existing orders are non-contiguous.
 */
export async function getNextOrder(
  table: Table,
  filter: Record<string, unknown>,
  explicitOrder: number | undefined,
): Promise<number> {
  if (explicitOrder !== undefined) return explicitOrder;
  const items = (await table.where(filter).sortBy("order")) as Array<{
    order: number;
  }>;
  if (items.length === 0) return 0;
  return items[items.length - 1].order + 1;
}

/**
 * Like {@link getNextOrder} but for entities whose order sequence is scoped by
 * project where `projectId` may be null (global). A null projectId is not a
 * valid IndexedDB key, so `.where({ projectId: null })` would match nothing and
 * collide every global entry at order 0. Scan in JS and filter by exact scope.
 */
export async function getNextOrderForProjectScope(
  table: Table,
  projectId: string | null,
  explicitOrder: number | undefined,
): Promise<number> {
  if (explicitOrder !== undefined) return explicitOrder;
  const all = (await table.toArray()) as Array<{
    projectId: string | null;
    order: number;
  }>;
  const inScope = all.filter((r) => r.projectId === projectId);
  if (inScope.length === 0) return 0;
  return Math.max(...inScope.map((r) => r.order)) + 1;
}

export function now(): string {
  return new Date().toISOString();
}

/**
 * Drop keys whose value is `undefined` so a partial update never clears a field
 * the caller merely omitted. Dexie's `Table.update()` deletes any key set to
 * `undefined`; `null` is preserved as an explicit "clear this field" signal.
 */
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/** Format a Date as YYYY-MM-DD in local time (not UTC). */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function reorderEntities(
  table: Table,
  orderedIds: string[],
): Promise<void> {
  await db.transaction("rw", table, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await table.update(orderedIds[i], { order: i });
    }
  });
}
