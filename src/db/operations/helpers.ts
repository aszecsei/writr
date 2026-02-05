import type { Table } from "dexie";
import { generateId } from "@/lib/id";
import { db } from "../database";

export { generateId };

export function now(): string {
  return new Date().toISOString();
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
