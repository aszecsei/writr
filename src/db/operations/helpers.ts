import type { IndexableType, Table } from "dexie";
import { generateId } from "@/lib/id";
import { db } from "../database";

export { generateId };

/**
 * Return `explicitOrder` if provided, otherwise the next order value (max
 * existing + 1, or 0 if none) among rows matching `scope`. Using max+1
 * instead of count avoids collisions when existing orders are non-contiguous.
 *
 * `scope` is matched via Dexie's indexed `.where()` — except when one of its
 * values is `null`, since a null key isn't a valid IndexedDB index value and
 * `.where({ field: null })` would match nothing and collide every such row at
 * order 0. In that case the table is scanned in JS and filtered by exact
 * equality instead.
 *
 * `extraScope` narrows further to a sub-group within `scope` (e.g. siblings
 * under the same nullable `parentDocId`), for fields that also aren't valid
 * compound-index keys when null.
 */
export async function nextOrder(
  table: Table,
  scope: Record<string, unknown>,
  explicitOrder: number | undefined,
  extraScope?: (row: Record<string, unknown>) => boolean,
): Promise<number> {
  if (explicitOrder !== undefined) return explicitOrder;
  const hasNullScopeValue = Object.values(scope).some((v) => v === null);
  const scoped = (
    hasNullScopeValue
      ? (await table.toArray()).filter((r) =>
          Object.entries(scope).every(
            ([key, value]) => (r as Record<string, unknown>)[key] === value,
          ),
        )
      : await table.where(scope).sortBy("order")
  ) as Array<{ order: number }>;
  const inScope = extraScope
    ? scoped.filter((r) => extraScope(r as Record<string, unknown>))
    : scoped;
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

/**
 * Assign `order` = index within `orderedIds` to every row in that id
 * sequence. Pass `touchUpdatedAt` to also bump `updatedAt` (once, shared
 * across the whole batch) on every written row.
 */
export async function renumber(
  table: Table,
  orderedIds: string[],
  opts: { touchUpdatedAt?: boolean } = {},
): Promise<void> {
  const ts = opts.touchUpdatedAt ? now() : undefined;
  for (let i = 0; i < orderedIds.length; i++) {
    await table.update(
      orderedIds[i],
      ts ? { order: i, updatedAt: ts } : { order: i },
    );
  }
}

/**
 * Close gaps in `rows` (already sorted by `order`) so they occupy a
 * contiguous 0..n-1 range. Rows whose order is already correct are left
 * untouched. Pass `touchUpdatedAt` to bump `updatedAt` on rows that change.
 */
export async function compact(
  table: Table,
  rows: Array<{ id: string; order: number }>,
  opts: { touchUpdatedAt?: boolean } = {},
): Promise<void> {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].order === i) continue;
    await table.update(
      rows[i].id,
      opts.touchUpdatedAt ? { order: i, updatedAt: now() } : { order: i },
    );
  }
}

export async function reorderEntities(
  table: Table,
  orderedIds: string[],
): Promise<void> {
  await db.transaction("rw", table, () => renumber(table, orderedIds));
}

/**
 * Minimal shape `createCrud` needs — deliberately narrower than Dexie's
 * `Table`/`EntityTable` interfaces, which disagree with each other on other
 * methods (like `modify`) in ways that break generic inference, even though
 * `get` and `delete` are the only methods `createCrud` calls.
 */
interface GetDeleteTable<T, Key extends IndexableType> {
  get(id: Key): Promise<T | undefined>;
  delete(id: Key): Promise<void>;
}

/**
 * Plain `get(id)` / `delete(id)` wrappers for entities with no extra logic on
 * either operation (no cascade, no validation).
 */
export function createCrud<T, Key extends IndexableType>(
  table: GetDeleteTable<T, Key>,
): {
  get: (id: Key) => Promise<T | undefined>;
  delete: (id: Key) => Promise<void>;
} {
  return {
    get: (id: Key) => table.get(id),
    delete: (id: Key) => table.delete(id),
  };
}
