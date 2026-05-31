import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import {
  getOutlineGridCellsByProject,
  getOutlineGridColumnsByProject,
  getOutlineGridRowsByProject,
} from "@/db/operations/outline";
import type { ProjectId } from "@/db/schemas";
import {
  makeChapter,
  makeOutlineGridColumn,
  makeOutlineGridRow,
  resetIdCounter,
} from "@/test/helpers";
import { executeTool } from "../tools";
import type { ToolExecutionContext } from "../types";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const otherProjectId = "a2222222-2222-4222-a222-222222222222" as ProjectId;
const ctx: ToolExecutionContext = { projectId };

interface Ref {
  id: string;
  shortId: string;
}

async function createColumn(title: string): Promise<Ref> {
  const r = await executeTool(
    "manage_outline_columns",
    { op: "create", title },
    ctx,
  );
  expect(r.success).toBe(true);
  return { id: r.data?.columnId as string, shortId: r.data?.shortId as string };
}

async function createRow(label?: string): Promise<Ref> {
  const r = await executeTool(
    "manage_outline_rows",
    { op: "create", label },
    ctx,
  );
  expect(r.success).toBe(true);
  return { id: r.data?.rowId as string, shortId: r.data?.shortId as string };
}

async function writeCell(rowRef: string, columnRef: string, content: string) {
  const r = await executeTool(
    "write_outline_cell",
    { mode: "set", rowRef, columnRef, content },
    ctx,
  );
  expect(r.success).toBe(true);
}

beforeEach(async () => {
  resetIdCounter();
  await db.outlineGridColumns.clear();
  await db.outlineGridRows.clear();
  await db.outlineGridCells.clear();
  await db.chapters.clear();
});

describe("manage_outline_columns", () => {
  it("create adds a column and returns its full and short ids", async () => {
    const r = await executeTool(
      "manage_outline_columns",
      { op: "create", title: "Beat" },
      ctx,
    );
    expect(r.success).toBe(true);
    expect(r.data?.columnId).toBeTruthy();
    expect(r.data?.shortId).toBeTruthy();

    const cols = await getOutlineGridColumnsByProject(projectId);
    expect(cols).toHaveLength(1);
    expect(cols[0].title).toBe("Beat");
  });

  it("create at an index shifts existing columns right", async () => {
    await createColumn("A");
    await createColumn("B");
    const r = await executeTool(
      "manage_outline_columns",
      { op: "create", title: "X", atIndex: 0 },
      ctx,
    );
    expect(r.success).toBe(true);

    const cols = await getOutlineGridColumnsByProject(projectId);
    expect(cols.map((c) => c.title)).toEqual(["X", "A", "B"]);
  });

  it("rename changes a column's title", async () => {
    const c = await createColumn("Old");
    const r = await executeTool(
      "manage_outline_columns",
      { op: "rename", columnRef: c.id, title: "New" },
      ctx,
    );
    expect(r.success).toBe(true);

    const cols = await getOutlineGridColumnsByProject(projectId);
    expect(cols[0].title).toBe("New");
  });

  it("delete removes the column and cascades to its cells", async () => {
    const col = await createColumn("Beat");
    const row = await createRow("R1");
    await writeCell(row.id, col.id, "some content");
    expect(await getOutlineGridCellsByProject(projectId)).toHaveLength(1);

    const r = await executeTool(
      "manage_outline_columns",
      { op: "delete", columnRef: col.id },
      ctx,
    );
    expect(r.success).toBe(true);
    expect(await getOutlineGridColumnsByProject(projectId)).toHaveLength(0);
    expect(await getOutlineGridCellsByProject(projectId)).toHaveLength(0);
  });

  it("reorder reindexes columns to the given order", async () => {
    const a = await createColumn("A");
    const b = await createColumn("B");
    const c = await createColumn("C");
    const r = await executeTool(
      "manage_outline_columns",
      { op: "reorder", orderedColumnRefs: [c.id, a.id, b.id] },
      ctx,
    );
    expect(r.success).toBe(true);

    const cols = await getOutlineGridColumnsByProject(projectId);
    expect(cols.map((col) => col.title)).toEqual(["C", "A", "B"]);
  });

  it("reorder rejects a partial id set", async () => {
    const a = await createColumn("A");
    await createColumn("B");
    const r = await executeTool(
      "manage_outline_columns",
      { op: "reorder", orderedColumnRefs: [a.id] },
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/all 2 column ids/);
  });

  it("fails on an unknown column ref", async () => {
    const r = await executeTool(
      "manage_outline_columns",
      { op: "rename", columnRef: "zzzzzz", title: "X" },
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/unknown column ref/);
  });
});

describe("manage_outline_rows", () => {
  it("create adds a row and returns its full and short ids", async () => {
    const r = await executeTool(
      "manage_outline_rows",
      { op: "create", label: "Opening" },
      ctx,
    );
    expect(r.success).toBe(true);
    expect(r.data?.rowId).toBeTruthy();
    expect(r.data?.shortId).toBeTruthy();

    const rows = await getOutlineGridRowsByProject(projectId);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe("Opening");
  });

  it("relabel changes an unlinked row's label", async () => {
    const row = await createRow("Old beat");
    const r = await executeTool(
      "manage_outline_rows",
      { op: "relabel", rowRef: row.id, label: "New beat" },
      ctx,
    );
    expect(r.success).toBe(true);

    const rows = await getOutlineGridRowsByProject(projectId);
    expect(rows[0].label).toBe("New beat");
  });

  it("relabel refuses a chapter-linked row", async () => {
    const chapter = makeChapter({ projectId, title: "Ch1" });
    await db.chapters.add(chapter);
    const linked = makeOutlineGridRow({
      projectId,
      linkedChapterId: chapter.id,
      label: "",
    });
    await db.outlineGridRows.add(linked);

    const r = await executeTool(
      "manage_outline_rows",
      { op: "relabel", rowRef: linked.id, label: "Hijack" },
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/linked to a chapter/);
    expect(await getOutlineGridRowsByProject(projectId)).toHaveLength(1);
  });

  it("delete removes the row, its cells, and recompacts order", async () => {
    const col = await createColumn("Beat");
    const r1 = await createRow("R1");
    const r2 = await createRow("R2");
    await writeCell(r1.id, col.id, "content for r1");

    const r = await executeTool(
      "manage_outline_rows",
      { op: "delete", rowRef: r1.id },
      ctx,
    );
    expect(r.success).toBe(true);

    const rows = await getOutlineGridRowsByProject(projectId);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(r2.id);
    expect(rows[0].order).toBe(0);
    expect(await getOutlineGridCellsByProject(projectId)).toHaveLength(0);
  });

  it("delete refuses a chapter-linked row", async () => {
    const chapter = makeChapter({ projectId, title: "Ch1" });
    await db.chapters.add(chapter);
    const linked = makeOutlineGridRow({
      projectId,
      linkedChapterId: chapter.id,
      label: "",
    });
    await db.outlineGridRows.add(linked);

    const r = await executeTool(
      "manage_outline_rows",
      { op: "delete", rowRef: linked.id },
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/linked to a chapter/);
    expect(await getOutlineGridRowsByProject(projectId)).toHaveLength(1);
  });

  it("reorder reindexes rows to the given order", async () => {
    const a = await createRow("A");
    const b = await createRow("B");
    const r = await executeTool(
      "manage_outline_rows",
      { op: "reorder", orderedRowRefs: [b.id, a.id] },
      ctx,
    );
    expect(r.success).toBe(true);

    const rows = await getOutlineGridRowsByProject(projectId);
    expect(rows.map((row) => row.label)).toEqual(["B", "A"]);
  });
});

describe("write_outline_cell", () => {
  it("set creates a cell with the given content", async () => {
    const col = await createColumn("Beat");
    const row = await createRow("R1");
    const r = await executeTool(
      "write_outline_cell",
      { mode: "set", rowRef: row.id, columnRef: col.id, content: "He runs." },
      ctx,
    );
    expect(r.success).toBe(true);

    const cells = await getOutlineGridCellsByProject(projectId);
    expect(cells).toHaveLength(1);
    expect(cells[0].content).toBe("He runs.");
  });

  it("append joins onto existing content with a blank line", async () => {
    const col = await createColumn("Beat");
    const row = await createRow("R1");
    await writeCell(row.id, col.id, "He runs.");
    await executeTool(
      "write_outline_cell",
      {
        mode: "append",
        rowRef: row.id,
        columnRef: col.id,
        content: "Heart pounding, sure he is already too late.",
      },
      ctx,
    );

    const cells = await getOutlineGridCellsByProject(projectId);
    expect(cells[0].content).toBe(
      "He runs.\n\nHeart pounding, sure he is already too late.",
    );
  });

  it("clear empties content but preserves color", async () => {
    const col = await createColumn("Beat");
    const row = await createRow("R1");
    await executeTool(
      "write_outline_cell",
      {
        mode: "set",
        rowRef: row.id,
        columnRef: col.id,
        content: "filled",
        color: "blue",
      },
      ctx,
    );
    await executeTool(
      "write_outline_cell",
      { mode: "clear", rowRef: row.id, columnRef: col.id },
      ctx,
    );

    const cells = await getOutlineGridCellsByProject(projectId);
    expect(cells[0].content).toBe("");
    expect(cells[0].color).toBe("blue");
  });

  it("set with a color writes both", async () => {
    const col = await createColumn("Beat");
    const row = await createRow("R1");
    await executeTool(
      "write_outline_cell",
      {
        mode: "set",
        rowRef: row.id,
        columnRef: col.id,
        content: "x",
        color: "green",
      },
      ctx,
    );

    const cells = await getOutlineGridCellsByProject(projectId);
    expect(cells[0].color).toBe("green");
    expect(cells[0].content).toBe("x");
  });

  it("rejects set/append with no content", async () => {
    const col = await createColumn("Beat");
    const row = await createRow("R1");
    const r = await executeTool(
      "write_outline_cell",
      { mode: "set", rowRef: row.id, columnRef: col.id },
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.message).toContain("Invalid parameters");
  });
});

describe("set_outline_cell_color", () => {
  it("colors an existing cell without touching its content", async () => {
    const col = await createColumn("Beat");
    const row = await createRow("R1");
    await writeCell(row.id, col.id, "keep me");

    const r = await executeTool(
      "set_outline_cell_color",
      { rowRef: row.id, columnRef: col.id, color: "pink" },
      ctx,
    );
    expect(r.success).toBe(true);

    const cells = await getOutlineGridCellsByProject(projectId);
    expect(cells[0].color).toBe("pink");
    expect(cells[0].content).toBe("keep me");
  });

  it("colors a not-yet-existing cell by creating it empty", async () => {
    const col = await createColumn("Beat");
    const row = await createRow("R1");
    const r = await executeTool(
      "set_outline_cell_color",
      { rowRef: row.id, columnRef: col.id, color: "orange" },
      ctx,
    );
    expect(r.success).toBe(true);

    const cells = await getOutlineGridCellsByProject(projectId);
    expect(cells).toHaveLength(1);
    expect(cells[0].color).toBe("orange");
    expect(cells[0].content).toBe("");
  });
});

describe("reference resolution and project isolation", () => {
  it("resolves a row and column by their short ids", async () => {
    const col = await createColumn("Beat");
    const row = await createRow("R1");
    const r = await executeTool(
      "write_outline_cell",
      {
        mode: "set",
        rowRef: row.shortId,
        columnRef: col.shortId,
        content: "via short id",
      },
      ctx,
    );
    expect(r.success).toBe(true);

    const cells = await getOutlineGridCellsByProject(projectId);
    expect(cells[0].content).toBe("via short id");
  });

  it("resolves a row by exact label and a column by exact title", async () => {
    await createColumn("Beat");
    await createRow("Opening");
    const r = await executeTool(
      "write_outline_cell",
      { mode: "set", rowRef: "Opening", columnRef: "Beat", content: "by name" },
      ctx,
    );
    expect(r.success).toBe(true);
  });

  it("fails when a title ref matches more than one column", async () => {
    await createColumn("Beat");
    await createColumn("Beat");
    const row = await createRow("R1");
    const r = await executeTool(
      "write_outline_cell",
      { mode: "set", rowRef: row.id, columnRef: "Beat", content: "?" },
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/matches more than one/);
  });

  it("cannot target a column belonging to a different project", async () => {
    const foreign = makeOutlineGridColumn({
      projectId: otherProjectId,
      title: "Foreign",
    });
    await db.outlineGridColumns.add(foreign);

    const r = await executeTool(
      "manage_outline_columns",
      { op: "rename", columnRef: foreign.id, title: "Hijacked" },
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/unknown column ref/);

    const untouched = await db.outlineGridColumns.get(foreign.id);
    expect(untouched?.title).toBe("Foreign");
  });
});
