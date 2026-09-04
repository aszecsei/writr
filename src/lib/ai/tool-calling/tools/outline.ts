import { z } from "zod";
import {
  createOutlineGridColumn,
  createOutlineGridRow,
  deleteOutlineGridColumn,
  deleteOutlineGridRow,
  getOutlineGridCell,
  getOutlineGridColumnsByProject,
  getOutlineGridRowsByProject,
  insertOutlineGridColumnAt,
  insertOutlineGridRowAt,
  reorderOutlineGridColumns,
  reorderOutlineGridRows,
  updateOutlineGridCellColor,
  updateOutlineGridColumn,
  updateOutlineGridRow,
  upsertOutlineGridCell,
} from "@/db/operations/outline";
import {
  OutlineCardColorEnum,
  type OutlineGridColumn,
  type OutlineGridRow,
  type ProjectId,
} from "@/db/schemas";
import { shortOutlineId } from "@/lib/ai/serialize";
import { defineTool } from "../types";
import { fail, ok } from "./helpers";

// ─── Reference resolution ───────────────────────────────────────────
//
// The outline read tool (`get:outline`) emits a short `id` per row/column
// (last six hex digits of the UUID — see `shortOutlineId`). These tools accept
// that short id, the full UUID, OR the exact title/label as a `ref`, resolving
// it against the PROJECT'S OWN entities only. A ref that names an entity in a
// different project simply won't resolve, which is what enforces project
// isolation here — there is no cross-project lookup to leak through.

type ResolveResult<T> = { ok: true; value: T } | { ok: false; error: string };

function resolveByRef<T extends { id: string }>(
  items: T[],
  ref: string,
  kind: "row" | "column",
  getLabel: (item: T) => string,
): ResolveResult<T> {
  const needle = ref.trim();

  const byFullId = items.filter((i) => i.id === needle);
  if (byFullId.length === 1) return { ok: true, value: byFullId[0] };

  const byShortId = items.filter((i) => shortOutlineId(i.id) === needle);
  if (byShortId.length === 1) return { ok: true, value: byShortId[0] };
  if (byShortId.length > 1)
    return {
      ok: false,
      error: `${kind} ref "${ref}" is ambiguous — use the full id`,
    };

  const byLabel = items.filter((i) => getLabel(i) === needle);
  if (byLabel.length === 1) return { ok: true, value: byLabel[0] };
  if (byLabel.length > 1)
    return {
      ok: false,
      error: `${kind} ref "${ref}" matches more than one ${kind} by title — use the id instead`,
    };

  return {
    ok: false,
    error: `unknown ${kind} ref "${ref}" — read the outline to refresh the ids`,
  };
}

async function resolveColumn(
  projectId: ProjectId,
  ref: string,
): Promise<ResolveResult<OutlineGridColumn>> {
  const columns = await getOutlineGridColumnsByProject(projectId);
  return resolveByRef(columns, ref, "column", (c) => c.title);
}

async function resolveRow(
  projectId: ProjectId,
  ref: string,
): Promise<ResolveResult<OutlineGridRow>> {
  const rows = await getOutlineGridRowsByProject(projectId);
  return resolveByRef(rows, ref, "row", (r) => r.label);
}

/**
 * Resolve a reorder request: every entity in the project must appear exactly
 * once. `reorderEntities` reindexes the listed ids to 0..n, so a partial list
 * would collapse the omitted entities onto colliding orders — reject it.
 */
function resolveReorder<T extends { id: string }>(
  items: T[],
  refs: string[],
  kind: "row" | "column",
  getLabel: (item: T) => string,
): ResolveResult<T["id"][]> {
  if (refs.length !== items.length)
    return {
      ok: false,
      error: `reorder requires all ${items.length} ${kind} ids exactly once; got ${refs.length}`,
    };

  const orderedIds: T["id"][] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const res = resolveByRef(items, ref, kind, getLabel);
    if (!res.ok) return res;
    if (seen.has(res.value.id))
      return {
        ok: false,
        error: `reorder lists ${kind} "${ref}" more than once`,
      };
    seen.add(res.value.id);
    orderedIds.push(res.value.id);
  }
  return { ok: true, value: orderedIds };
}

// ─── manage_outline_columns ─────────────────────────────────────────

const COLUMN_OP_DESCRIPTION = "Which column operation to perform.";
const COLUMN_TITLE_DESCRIPTION =
  "Column title. Required for create and rename.";
const COLUMN_REF_DESCRIPTION =
  "Target column — its id (from reading the outline) or exact title. Required for rename and delete.";

const ColumnOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create").describe(COLUMN_OP_DESCRIPTION),
    title: z.string().min(1).describe(COLUMN_TITLE_DESCRIPTION),
    atIndex: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "Optional 0-based insert position for create; appends to the right if omitted.",
      )
      .optional(),
  }),
  z.object({
    op: z.literal("rename").describe(COLUMN_OP_DESCRIPTION),
    columnRef: z.string().min(1).describe(COLUMN_REF_DESCRIPTION),
    title: z.string().min(1).describe(COLUMN_TITLE_DESCRIPTION),
  }),
  z.object({
    op: z.literal("delete").describe(COLUMN_OP_DESCRIPTION),
    columnRef: z.string().min(1).describe(COLUMN_REF_DESCRIPTION),
  }),
  z.object({
    op: z.literal("reorder").describe(COLUMN_OP_DESCRIPTION),
    orderedColumnRefs: z
      .array(z.string().min(1))
      .min(1)
      .describe(
        "For reorder: the complete set of column ids in the new left-to-right order.",
      ),
  }),
]);

export const manageOutlineColumnsTool = defineTool({
  id: "manage_outline_columns",
  name: "Manage Outline Columns",
  description:
    "Create, rename, delete, or reorder columns of the outline grid. " +
    "Columns are lenses applied to every beat. " +
    "op=create adds a column (optional 0-based atIndex; appends if omitted) and returns its id. " +
    "op=rename/delete target a column by id or exact title (columnRef); delete also removes that column's cells. " +
    "op=reorder takes orderedColumnRefs — the COMPLETE set of column ids in the new left-to-right order.",
  inputSchema: ColumnOpSchema,
  requiresApproval: true,
  async execute(params, context) {
    if (params.op === "create") {
      const column =
        params.atIndex !== undefined
          ? await insertOutlineGridColumnAt(
              context.projectId,
              params.title,
              params.atIndex,
            )
          : await createOutlineGridColumn({
              projectId: context.projectId,
              title: params.title,
            });
      return ok(`Added outline column "${params.title}"`, {
        columnId: column.id,
        shortId: shortOutlineId(column.id),
      });
    }

    if (params.op === "rename") {
      const res = await resolveColumn(context.projectId, params.columnRef);
      if (!res.ok) return fail(res.error);
      await updateOutlineGridColumn(res.value.id, { title: params.title });
      return ok(`Renamed column to "${params.title}"`);
    }

    if (params.op === "delete") {
      const res = await resolveColumn(context.projectId, params.columnRef);
      if (!res.ok) return fail(res.error);
      await deleteOutlineGridColumn(res.value.id);
      return ok(`Deleted column "${res.value.title}" and its cells`);
    }

    const columns = await getOutlineGridColumnsByProject(context.projectId);
    const res = resolveReorder(
      columns,
      params.orderedColumnRefs,
      "column",
      (c) => c.title,
    );
    if (!res.ok) return fail(res.error);
    await reorderOutlineGridColumns(res.value);
    return ok(`Reordered ${res.value.length} columns`);
  },
});

// ─── manage_outline_rows ────────────────────────────────────────────

const ROW_OP_DESCRIPTION = "Which row operation to perform.";
const ROW_LABEL_DESCRIPTION =
  "Row label (the beat's short name). Optional for create; required for relabel.";
const ROW_REF_DESCRIPTION =
  "Target row — its id (from reading the outline) or exact label. Required for relabel and delete.";

const RowOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create").describe(ROW_OP_DESCRIPTION),
    label: z.string().describe(ROW_LABEL_DESCRIPTION).optional(),
    atIndex: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "Optional 0-based insert position for create; appends to the bottom if omitted.",
      )
      .optional(),
  }),
  z.object({
    op: z.literal("relabel").describe(ROW_OP_DESCRIPTION),
    rowRef: z.string().min(1).describe(ROW_REF_DESCRIPTION),
    label: z.string().describe(ROW_LABEL_DESCRIPTION),
  }),
  z.object({
    op: z.literal("delete").describe(ROW_OP_DESCRIPTION),
    rowRef: z.string().min(1).describe(ROW_REF_DESCRIPTION),
  }),
  z.object({
    op: z.literal("reorder").describe(ROW_OP_DESCRIPTION),
    orderedRowRefs: z
      .array(z.string().min(1))
      .min(1)
      .describe(
        "For reorder: the complete set of row ids in the new top-to-bottom order.",
      ),
  }),
]);

const CHAPTER_LINKED_MSG =
  "this row is linked to a chapter; its label is the chapter title and is out of scope for the outline agent — edit or unlink it from the chapter instead";

export const manageOutlineRowsTool = defineTool({
  id: "manage_outline_rows",
  name: "Manage Outline Rows",
  description:
    "Create, relabel, delete, or reorder rows of the outline grid. " +
    "Each row is a single story beat, in narrative order top to bottom. " +
    "op=create adds a row (optional label, optional 0-based atIndex; appends if omitted) and returns its id. " +
    "op=relabel/delete target a row by id or exact label (rowRef); delete also removes that row's cells. " +
    "Rows linked to a chapter cannot be relabeled or deleted here (that would touch the manuscript). " +
    "op=reorder takes orderedRowRefs — the COMPLETE set of row ids in the new top-to-bottom order.",
  inputSchema: RowOpSchema,
  requiresApproval: true,
  async execute(params, context) {
    if (params.op === "create") {
      const label = params.label ?? "";
      const row =
        params.atIndex !== undefined
          ? await insertOutlineGridRowAt(
              context.projectId,
              params.atIndex,
              label,
            )
          : await createOutlineGridRow({
              projectId: context.projectId,
              label,
            });
      return ok(`Added outline row${label ? ` "${label}"` : ""}`, {
        rowId: row.id,
        shortId: shortOutlineId(row.id),
      });
    }

    if (params.op === "relabel") {
      const res = await resolveRow(context.projectId, params.rowRef);
      if (!res.ok) return fail(res.error);
      if (res.value.linkedChapterId !== null) return fail(CHAPTER_LINKED_MSG);
      await updateOutlineGridRow(res.value.id, { label: params.label });
      return ok(`Relabeled row to "${params.label}"`);
    }

    if (params.op === "delete") {
      const res = await resolveRow(context.projectId, params.rowRef);
      if (!res.ok) return fail(res.error);
      if (res.value.linkedChapterId !== null) return fail(CHAPTER_LINKED_MSG);
      await deleteOutlineGridRow(res.value.id);
      return ok("Deleted outline row and its cells");
    }

    const rows = await getOutlineGridRowsByProject(context.projectId);
    const res = resolveReorder(
      rows,
      params.orderedRowRefs,
      "row",
      (r) => r.label,
    );
    if (!res.ok) return fail(res.error);
    await reorderOutlineGridRows(res.value);
    return ok(`Reordered ${res.value.length} rows`);
  },
});

// ─── write_outline_cell ─────────────────────────────────────────────

const CELL_MODE_DESCRIPTION =
  "set replaces content; append adds to existing content; clear empties it.";
const CELL_ROW_REF_DESCRIPTION = "Target row — its id or exact label.";
const CELL_COLUMN_REF_DESCRIPTION = "Target column — its id or exact title.";
const CELL_CONTENT_DESCRIPTION =
  "The cell text — the braided beat. Required for set and append.";
const CELL_COLOR_DESCRIPTION = "Optional cell color.";

const CellWriteSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("set").describe(CELL_MODE_DESCRIPTION),
    rowRef: z.string().min(1).describe(CELL_ROW_REF_DESCRIPTION),
    columnRef: z.string().min(1).describe(CELL_COLUMN_REF_DESCRIPTION),
    content: z.string().min(1).describe(CELL_CONTENT_DESCRIPTION),
    color: OutlineCardColorEnum.describe(CELL_COLOR_DESCRIPTION).optional(),
  }),
  z.object({
    mode: z.literal("append").describe(CELL_MODE_DESCRIPTION),
    rowRef: z.string().min(1).describe(CELL_ROW_REF_DESCRIPTION),
    columnRef: z.string().min(1).describe(CELL_COLUMN_REF_DESCRIPTION),
    content: z.string().min(1).describe(CELL_CONTENT_DESCRIPTION),
    color: OutlineCardColorEnum.describe(CELL_COLOR_DESCRIPTION).optional(),
  }),
  z.object({
    mode: z.literal("clear").describe(CELL_MODE_DESCRIPTION),
    rowRef: z.string().min(1).describe(CELL_ROW_REF_DESCRIPTION),
    columnRef: z.string().min(1).describe(CELL_COLUMN_REF_DESCRIPTION),
    color: OutlineCardColorEnum.describe(CELL_COLOR_DESCRIPTION).optional(),
  }),
]);

export const writeOutlineCellTool = defineTool({
  id: "write_outline_cell",
  name: "Write Outline Cell",
  description:
    "Write the content of a single cell — the intersection of a row (beat) and a column (lens). " +
    "Target the cell with rowRef + columnRef (ids from reading the outline, or exact label/title). " +
    "mode=set replaces the cell content; mode=append adds to it (joined by a blank line); " +
    "mode=clear empties the content (color is preserved). " +
    "Optionally set the cell color in the same call.",
  inputSchema: CellWriteSchema,
  requiresApproval: true,
  async execute(params, context) {
    const rowRes = await resolveRow(context.projectId, params.rowRef);
    if (!rowRes.ok) return fail(rowRes.error);
    const colRes = await resolveColumn(context.projectId, params.columnRef);
    if (!colRes.ok) return fail(colRes.error);
    const row = rowRes.value;
    const column = colRes.value;

    let content: string;
    if (params.mode === "clear") {
      content = "";
    } else if (params.mode === "append") {
      const existing = await getOutlineGridCell(row.id, column.id);
      content = existing?.content
        ? `${existing.content}\n\n${params.content}`
        : params.content;
    } else {
      content = params.content;
    }

    await upsertOutlineGridCell({
      projectId: context.projectId,
      rowId: row.id,
      columnId: column.id,
      content,
      color: params.color,
    });

    const rowName = row.label || shortOutlineId(row.id);
    return ok(`Wrote cell [${rowName} × ${column.title}]`, {
      rowId: row.id,
      columnId: column.id,
    });
  },
});

// ─── set_outline_cell_color ─────────────────────────────────────────

const CellColorSchema = z.object({
  rowRef: z.string().min(1).describe(CELL_ROW_REF_DESCRIPTION),
  columnRef: z.string().min(1).describe(CELL_COLUMN_REF_DESCRIPTION),
  color: OutlineCardColorEnum.describe("The cell color."),
});

export const setOutlineCellColorTool = defineTool({
  id: "set_outline_cell_color",
  name: "Set Outline Cell Color",
  description:
    "Set the background color of a single cell without touching its content. " +
    "Use to color-code beats (e.g. tension, POV, status). " +
    "Target the cell with rowRef + columnRef (ids from reading the outline, or exact label/title).",
  inputSchema: CellColorSchema,
  requiresApproval: true,
  async execute(params, context) {
    const rowRes = await resolveRow(context.projectId, params.rowRef);
    if (!rowRes.ok) return fail(rowRes.error);
    const colRes = await resolveColumn(context.projectId, params.columnRef);
    if (!colRes.ok) return fail(colRes.error);
    const row = rowRes.value;
    const column = colRes.value;

    const existing = await getOutlineGridCell(row.id, column.id);
    if (existing) {
      await updateOutlineGridCellColor(row.id, column.id, params.color);
    } else {
      // Color an empty cell by creating it — `updateOutlineGridCellColor`
      // is a no-op when the cell row doesn't exist yet.
      await upsertOutlineGridCell({
        projectId: context.projectId,
        rowId: row.id,
        columnId: column.id,
        color: params.color,
      });
    }

    const rowName = row.label || shortOutlineId(row.id);
    return ok(`Set [${rowName} × ${column.title}] to ${params.color}`);
  },
});
