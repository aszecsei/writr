"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useParams, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { SortableTimelineCard } from "@/components/bible/SortableTimelineCard";
import { createTimelineEvent, reorderTimelineEvents } from "@/db/operations";
import { useTimelineByProject } from "@/hooks/useBibleEntries";

export default function TimelinePage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const events = useTimelineByProject(params.projectId);
  const [newTitle, setNewTitle] = useState("");

  // Local state for optimistic drag reordering.
  // Mirrors the Dexie live query but can be reordered independently during drag.
  const [localEvents, setLocalEvents] = useState(events ?? []);
  const previousEvents = useRef(localEvents);
  const isDragging = useRef(false);

  // Sync Dexie live query -> local state (suppressed during drag)
  useEffect(() => {
    if (events && !isDragging.current) {
      setLocalEvents(events);
    }
  }, [events]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createTimelineEvent({
      projectId: params.projectId,
      title: newTitle.trim(),
    });
    setNewTitle("");
  }

  return (
    <div className="mx-auto max-w-editor px-8 py-8">
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        Timeline
      </h2>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Track in-universe events in chronological order.
      </p>

      <form onSubmit={handleAdd} className="mt-6 flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New event title..."
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <button
          type="submit"
          disabled={!newTitle.trim()}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
        >
          Add
        </button>
      </form>

      <DragDropProvider
        onDragStart={() => {
          isDragging.current = true;
          previousEvents.current = localEvents;
        }}
        onDragOver={(event) => {
          setLocalEvents((items) => move(items, event));
        }}
        onDragEnd={async (event) => {
          isDragging.current = false;
          if (event.canceled) {
            setLocalEvents(previousEvents.current);
            return;
          }
          const orderedIds = localEvents.map((e) => e.id);
          await reorderTimelineEvents(orderedIds);
        }}
      >
        <div className="mt-6 space-y-4">
          {localEvents.length === 0 && (
            <p className="py-12 text-center text-sm text-neutral-400 dark:text-neutral-500">
              No timeline events yet.
            </p>
          )}
          {localEvents.map((event, index) => (
            <SortableTimelineCard
              key={event.id}
              event={event}
              index={index}
              isHighlighted={event.id === highlightId}
            />
          ))}
        </div>
      </DragDropProvider>
    </div>
  );
}
