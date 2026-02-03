"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  createOutlineCard,
  deleteOutlineColumn,
  updateOutlineColumn,
} from "@/db/operations";
import type { OutlineCard as OutlineCardType } from "@/db/schemas";
import { OutlineCard } from "./OutlineCard";

interface OutlineColumnProps {
  column: { id: string; projectId: string; title: string };
  index: number;
  cards: OutlineCardType[];
  onCardClick: (card: OutlineCardType) => void;
}

export function OutlineColumn({
  column,
  index,
  cards,
  onCardClick,
}: OutlineColumnProps) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: column.id,
    index,
    group: "columns",
    type: "column",
  });

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function commitTitle() {
    setEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== column.title) {
      await updateOutlineColumn(column.id, { title: trimmed });
    } else {
      setTitle(column.title);
    }
  }

  async function handleDelete() {
    await deleteOutlineColumn(column.id);
  }

  async function handleAddCard() {
    await createOutlineCard({
      projectId: column.projectId,
      columnId: column.id,
      title: "New Card",
    });
  }

  return (
    <div
      ref={ref}
      className={`flex w-72 flex-shrink-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 ${
        isDragSource ? "opacity-50 ring-2 ring-zinc-400" : ""
      }`}
    >
      {/* Column header */}
      <div className="flex items-center gap-1 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <button
          type="button"
          ref={handleRef}
          className="cursor-grab rounded p-0.5 text-zinc-400 hover:text-zinc-600 active:cursor-grabbing dark:hover:text-zinc-300"
          aria-label="Drag column"
        >
          <GripVertical size={14} />
        </button>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setTitle(column.title);
                setEditing(false);
              }
            }}
            className="flex-1 bg-transparent text-sm font-semibold text-zinc-900 outline-none dark:text-zinc-100"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditing(true)}
            className="flex-1 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100"
          >
            {column.title}
          </button>
        )}
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {cards.length}
        </span>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded p-0.5 text-zinc-400 transition-colors hover:text-red-500"
          aria-label="Delete column"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Cards list */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {cards.map((card, i) => (
          <OutlineCard
            key={card.id}
            card={card}
            index={i}
            columnId={column.id}
            onClick={() => onCardClick(card)}
          />
        ))}
      </div>

      {/* Add card button */}
      <button
        type="button"
        onClick={handleAddCard}
        className="flex items-center gap-1 border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500 transition-colors hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
      >
        <Plus size={12} />
        Add Card
      </button>
    </div>
  );
}
