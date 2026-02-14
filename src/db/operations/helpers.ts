import type { Table } from "dexie";
import { generateId } from "@/lib/id";
import { db } from "../database";

export { generateId };

/** Return `data.order` if provided, otherwise count existing rows matching `filter`. */
export async function getNextOrder(
  table: Table,
  filter: Record<string, unknown>,
  explicitOrder: number | undefined,
): Promise<number> {
  if (explicitOrder !== undefined) return explicitOrder;
  return table.where(filter).count();
}

export function now(): string {
  return new Date().toISOString();
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
