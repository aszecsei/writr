import { beforeEach, describe, expect, it } from "vitest";
import { makeOutlineGridRow, resetIdCounter } from "@/test/helpers";
import { db } from "../database";
import type { ProjectId } from "../schemas";
import { getNextOrder } from "./helpers";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;

describe("getNextOrder", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.outlineGridRows.clear();
  });

  it("returns 0 when the table is empty", async () => {
    const next = await getNextOrder(
      db.outlineGridRows,
      { projectId },
      undefined,
    );
    expect(next).toBe(0);
  });

  it("returns max(order) + 1, not count, so it tolerates gaps", async () => {
    // Seed orders [0, 2] (gap at 1). count() would return 2 — colliding
    // with the existing row at order 2. max+1 must return 3.
    await db.outlineGridRows.bulkAdd([
      makeOutlineGridRow({ projectId, order: 0 }),
      makeOutlineGridRow({ projectId, order: 2 }),
    ]);

    const next = await getNextOrder(
      db.outlineGridRows,
      { projectId },
      undefined,
    );
    expect(next).toBe(3);
  });

  it("returns max(order) + 1 for contiguous orders", async () => {
    await db.outlineGridRows.bulkAdd([
      makeOutlineGridRow({ projectId, order: 0 }),
      makeOutlineGridRow({ projectId, order: 1 }),
      makeOutlineGridRow({ projectId, order: 2 }),
    ]);

    const next = await getNextOrder(
      db.outlineGridRows,
      { projectId },
      undefined,
    );
    expect(next).toBe(3);
  });

  it("passes through an explicit order unchanged", async () => {
    await db.outlineGridRows.bulkAdd([
      makeOutlineGridRow({ projectId, order: 0 }),
      makeOutlineGridRow({ projectId, order: 1 }),
    ]);

    const next = await getNextOrder(db.outlineGridRows, { projectId }, 99);
    expect(next).toBe(99);
  });
});
