"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { useCallback, useEffect, useRef, useState } from "react";
import { DragHandle } from "@/components/bible/DragHandle";
import type {
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow as OutlineGridRowType,
} from "@/db/schemas";
import { OutlineGridCell as GridCell } from "./OutlineGridCell";

interface OutlineGridRowProps {
  row: OutlineGridRowType;
  index: number;
  columns: OutlineGridColumn[];
  cellsMap: Map<string, OutlineGridCell>;
  chapterTitle?: string;
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
  chapterTitle,
  onRowLabelChange,
  onCellSave,
  onRowContextMenu,
  onCellContextMenu,
}: OutlineGridRowProps) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: row.id,
    index,
  });

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(chapterTitle || row.label || "");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayLabel = chapterTitle || row.label || "";

  // Sync when row label or chapter title changes externally
  useEffect(() => {
    if (!isEditingLabel) {
      setLabelValue(chapterTitle || row.label || "");
    }
  }, [row.label, chapterTitle, isEditingLabel]);

  const startEditing = useCallback(() => {
    setLabelValue(chapterTitle || row.label || "");
    setIsEditingLabel(true);
  }, [chapterTitle, row.label]);

  const saveAndClose = useCallback(() => {
    setIsEditingLabel(false);
    const trimmed = labelValue.trim();
    const currentValue = chapterTitle || row.label || "";
    if (trimmed !== currentValue) {
      // Sync logic is handled by the DB layer automatically
      onRowLabelChange(trimmed);
    }
  }, [labelValue, chapterTitle, row.label, onRowLabelChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setLabelValue(chapterTitle || row.label || "");
        setIsEditingLabel(false);
      } else if (e.key === "Enter") {
        saveAndClose();
      }
    },
    [chapterTitle, row.label, saveAndClose],
  );

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingLabel && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingLabel]);

  return (
    <tr ref={ref} className={isDragSource ? "opacity-50" : ""}>
      {/* Row header: drag handle + number + title */}
      <th
        className="sticky left-0 z-10 min-w-[180px] border border-zinc-200 bg-zinc-50 px-1 py-2 text-left font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-400"
        onContextMenu={onRowContextMenu}
      >
        <div className="flex items-center gap-1">
          <DragHandle ref={handleRef} />
          <span className="w-6 shrink-0 text-center text-xs text-zinc-400 dark:text-zinc-500">
            {row.order + 1}
          </span>
          {isEditingLabel ? (
            <input
              ref={inputRef}
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

      {/* Cells */}
      {columns.map((column) => {
        const cell = cellsMap.get(`${row.id}:${column.id}`);
        return (
          <GridCell
            key={column.id}
            cell={cell}
            onSave={(content) => onCellSave(column.id, content)}
            onContextMenu={(e) => onCellContextMenu(e, column.id)}
          />
        );
      })}
    </tr>
  );
}
