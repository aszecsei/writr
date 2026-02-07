"use client";

import { Columns3, Rows3 } from "lucide-react";

interface OutlineGridToolbarProps {
  onAddRow: () => void;
  onAddColumn: () => void;
}

export function OutlineGridToolbar({
  onAddRow,
  onAddColumn,
}: OutlineGridToolbarProps) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onAddRow}
        className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
      >
        <Rows3 size={14} />
        Add Row
      </button>
      <button
        type="button"
        onClick={onAddColumn}
        className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
      >
        <Columns3 size={14} />
        Add Column
      </button>
    </div>
  );
}
