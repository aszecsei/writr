import type {
  GuardrailEntry,
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow,
  StyleGuideEntry,
} from "@/db/schemas";
import { escapeAttr, escapeText } from "./xml";

export function buildNameMap<T extends { id: string }>(
  items: T[],
  getName: (item: T) => string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(item.id, getName(item));
  }
  return map;
}

export function serializeStyleGuideEntry(s: StyleGuideEntry): string {
  return `<rule title="${s.title}">\n${s.content}\n</rule>`;
}

/**
 * A guardrail is a negative: a named issue to flag, the phrases that surface
 * it, and how to correct it. `flags` are rendered as a list so the model can
 * match individual trigger patterns; `fix` / `positive-fix` are omitted when
 * empty to keep the block tight.
 */
export function serializeGuardrailEntry(g: GuardrailEntry): string {
  const lines: string[] = [`<guardrail label="${escapeAttr(g.label)}">`];
  if (g.flags.length > 0) {
    lines.push("<flags>");
    for (const flag of g.flags) {
      lines.push(`<flag>${escapeText(flag)}</flag>`);
    }
    lines.push("</flags>");
  }
  if (g.fix) lines.push(`<fix>${escapeText(g.fix)}</fix>`);
  if (g.positiveFix)
    lines.push(`<positive-fix>${escapeText(g.positiveFix)}</positive-fix>`);
  lines.push("</guardrail>");
  return lines.join("\n");
}

/**
 * A short, reorder-stable alias for an outline row/column/cell — the last six
 * hex digits of the entity UUID. Emitted by `serializeOutlineGrid` as the `id`
 * attribute and accepted by the outline-management tools as a reference, so the
 * model can target a specific row/column without echoing a full 36-char UUID.
 * Stable across reorders (unlike a positional index) and collision-safe within
 * a single project's grid (~hundreds of nodes).
 */
export function shortOutlineId(id: string): string {
  return id.replaceAll("-", "").slice(-6);
}

export function serializeOutlineGrid(
  columns: OutlineGridColumn[],
  rows: OutlineGridRow[],
  cells: OutlineGridCell[],
  chapterMap: Map<string, string>,
): string {
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);
  const sortedRows = [...rows].sort((a, b) => a.order - b.order);

  const cellMap = new Map<string, OutlineGridCell>();
  for (const cell of cells) {
    cellMap.set(`${cell.rowId}:${cell.columnId}`, cell);
  }

  const lines: string[] = [];

  // `id` is the short alias the outline-management tools accept to target an
  // entity; the cell tag keeps the column TITLE for readability since other
  // (read-only) agents share this serialization.
  lines.push("<columns>");
  for (const col of sortedColumns) {
    lines.push(`<column id="${shortOutlineId(col.id)}">${col.title}</column>`);
  }
  lines.push("</columns>");

  lines.push("<rows>");
  for (const row of sortedRows) {
    const chapterName = row.linkedChapterId
      ? chapterMap.get(row.linkedChapterId)
      : null;
    const label = chapterName || row.label || "Untitled";
    const chapterAttr = chapterName ? ` chapter="${chapterName}"` : "";

    lines.push(
      `<row id="${shortOutlineId(row.id)}" label="${label}"${chapterAttr}>`,
    );
    for (const col of sortedColumns) {
      const cell = cellMap.get(`${row.id}:${col.id}`);
      if (cell?.content) {
        lines.push(`<cell column="${col.title}">${cell.content}</cell>`);
      }
    }
    lines.push("</row>");
  }
  lines.push("</rows>");

  return lines.join("\n");
}
