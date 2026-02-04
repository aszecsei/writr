"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { useState } from "react";
import { deleteTimelineEvent, updateTimelineEvent } from "@/db/operations";
import { useHighlightFade } from "@/hooks/useHighlightFade";
import { DragHandle } from "./DragHandle";

interface SortableTimelineCardProps {
  event: {
    id: string;
    title: string;
    description: string;
    date: string;
  };
  index: number;
  isHighlighted?: boolean;
}

export function SortableTimelineCard({
  event,
  index,
  isHighlighted,
}: SortableTimelineCardProps) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: event.id,
    index,
  });
  const { elementRef, showHighlight } = useHighlightFade(isHighlighted);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [date, setDate] = useState(event.date);

  const mergeRefs = (node: HTMLDivElement | null) => {
    ref(node);
    (elementRef as React.MutableRefObject<HTMLDivElement | null>).current =
      node;
  };

  async function handleSave() {
    await updateTimelineEvent(event.id, { title, description, date });
    setEditing(false);
  }

  if (editing) {
    return (
      <div
        ref={mergeRefs}
        className={`space-y-3 rounded-lg border bg-white p-4 transition-all duration-500 dark:bg-zinc-900 ${
          showHighlight
            ? "border-yellow-400 ring-2 ring-yellow-400 dark:border-yellow-500 dark:ring-yellow-500"
            : "border-zinc-200 dark:border-zinc-800"
        }`}
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <input
          type="text"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          placeholder="In-universe date..."
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="Describe this event..."
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mergeRefs}
      className={`flex items-start gap-3 rounded-lg border bg-white px-4 py-4 transition-all duration-500 dark:bg-zinc-900 ${
        isDragSource
          ? "border-zinc-200 opacity-50 shadow-lg ring-2 ring-zinc-300 dark:border-zinc-800 dark:ring-zinc-600"
          : showHighlight
            ? "border-yellow-400 ring-2 ring-yellow-400 dark:border-yellow-500 dark:ring-yellow-500"
            : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <DragHandle ref={handleRef} />
      <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 border-zinc-400 dark:border-zinc-500" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {event.title}
        </h3>
        {event.date && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {event.date}
          </p>
        )}
        {event.description && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {event.description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => deleteTimelineEvent(event.id)}
          className="text-xs text-zinc-400 hover:text-red-500 dark:text-zinc-500"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
