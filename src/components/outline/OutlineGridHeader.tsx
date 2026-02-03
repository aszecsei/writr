"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OutlineGridColumn } from "@/db/schemas";

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
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(column.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when title changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditValue(column.title);
    }
  }, [column.title, isEditing]);

  const startEditing = useCallback(() => {
    setEditValue(column.title);
    setIsEditing(true);
  }, [column.title]);

  const saveAndClose = useCallback(() => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== column.title) {
      onRename(trimmed);
    } else {
      setEditValue(column.title);
    }
  }, [editValue, column.title, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditValue(column.title);
        setIsEditing(false);
      } else if (e.key === "Enter") {
        saveAndClose();
      }
    },
    [column.title, saveAndClose],
  );

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <th
      className="border border-zinc-200 bg-zinc-100 px-3 py-2 text-left font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      style={{ minWidth: column.width }}
      onContextMenu={onContextMenu}
    >
      {isEditing ? (
        <input
          ref={inputRef}
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
