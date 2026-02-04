"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { DragHandle } from "@/components/bible/DragHandle";
import type {
  ChapterStatus,
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow as OutlineGridRowType,
} from "@/db/schemas";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { OutlineGridCell as GridCell } from "./OutlineGridCell";
import { StatusBadge } from "./StatusBadge";

interface OutlineGridRowProps {
  row: OutlineGridRowType;
  index: number;
  columns: OutlineGridColumn[];
  cellsMap: Map<string, OutlineGridCell>;
  highlightCellId?: string | null;
  chapterTitle?: string;
  chapterStatus?: string;
  onRowLabelChange: (label: string) => void;
  onCellSave: (columnId: string, content: string) => void;
  onRowContextMenu: (e: React.MouseEvent) => void;
  onCellContextMenu: (e: React.MouseEvent, columnId: string) => void;
}

export function OutlineGridRow({
  row,
  index,
  columns,
  cellsMap,
  highlightCellId,
  chapterTitle,
  chapterStatus,
  onRowLabelChange,
  onCellSave,
  onRowContextMenu,
  onCellContextMenu,
}: OutlineGridRowProps) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: row.id,
    index,
  });

  const displayLabel = chapterTitle || row.label || "";

  const {
    isEditing: isEditingLabel,
    editValue: labelValue,
    setEditValue: setLabelValue,
    inputRef,
    startEditing,
    saveAndClose,
    handleKeyDown,
  } = useInlineEdit({
    initialValue: displayLabel,
    onSave: onRowLabelChange,
    saveOnEnter: true,
  });

  return (
    <tr ref={ref} className={isDragSource ? "opacity-50" : ""}>
      {/* Row header: drag handle + number + title */}
      <th
        className="sticky left-0 z-10 min-w-[180px] border border-zinc-200 bg-zinc-50 px-1 py-2 text-left font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
        onContextMenu={onRowContextMenu}
      >
        <div className="flex items-center gap-1">
          <DragHandle ref={handleRef} />
          <span className="w-6 shrink-0 text-center text-xs text-zinc-400 dark:text-zinc-500">
            {row.order + 1}
          </span>
          {isEditingLabel ? (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onBlur={saveAndClose}
              onKeyDown={handleKeyDown}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
              placeholder="Row label..."
            />
          ) : (
            <button
              type="button"
              className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm"
              onDoubleClick={startEditing}
              title={
                row.linkedChapterId
                  ? "Linked to chapter - Double-click to edit"
                  : "Double-click to edit"
              }
            >
              {displayLabel || (
                <span className="text-zinc-400 dark:text-zinc-500">
                  Untitled
                </span>
              )}
            </button>
          )}
        </div>
      </th>

      {/* Status cell (fixed, non-editable) */}
      <td className="border border-zinc-200 bg-white px-2 py-2 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <StatusBadge
          status={
            row.linkedChapterId
              ? (chapterStatus as ChapterStatus) || "draft"
              : "unlinked"
          }
        />
      </td>

      {/* Cells */}
      {columns.map((column) => {
        const cell = cellsMap.get(`${row.id}:${column.id}`);
        return (
          <GridCell
            key={column.id}
            cell={cell}
            isHighlighted={cell?.id === highlightCellId}
            onSave={(content) => onCellSave(column.id, content)}
            onContextMenu={(e) => onCellContextMenu(e, column.id)}
          />
        );
      })}
    </tr>
  );
}
