"use client";

import type { OutlineGridColumn } from "@/db/schemas";
import { useInlineEdit } from "@/hooks/forms/useInlineEdit";

interface OutlineGridHeaderProps {
  column: OutlineGridColumn;
  onRename: (title: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function OutlineGridHeader({
  column,
  onRename,
  onContextMenu,
}: OutlineGridHeaderProps) {
  const {
    isEditing,
    editValue,
    setEditValue,
    inputRef,
    startEditing,
    saveAndClose,
    handleKeyDown,
  } = useInlineEdit({
    initialValue: column.title,
    onSave: onRename,
    saveOnEnter: true,
  });

  return (
    <th
      className="border border-neutral-200 bg-neutral-100 px-3 py-2 text-left font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      style={{ minWidth: column.width }}
      onContextMenu={onContextMenu}
    >
      {isEditing ? (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveAndClose}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-sm font-medium outline-none"
        />
      ) : (
        <button
          type="button"
          className="w-full cursor-pointer select-none text-left text-sm"
          onDoubleClick={startEditing}
          title="Double-click to edit"
        >
          {column.title}
        </button>
      )}
    </th>
  );
}
