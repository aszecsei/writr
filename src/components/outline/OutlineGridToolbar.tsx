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
        className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <Rows3 size={14} />
        Add Row
      </button>
      <button
        type="button"
        onClick={onAddColumn}
        className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <Columns3 size={14} />
        Add Column
      </button>
    </div>
  );
}
