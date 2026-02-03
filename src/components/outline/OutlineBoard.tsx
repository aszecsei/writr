"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  createOutlineColumn,
  moveOutlineCards,
  reorderOutlineColumns,
} from "@/db/operations";
import type { OutlineCard as OutlineCardType } from "@/db/schemas";
import {
  useOutlineCardsByProject,
  useOutlineColumnsByProject,
} from "@/hooks/useOutline";
import { OutlineCardModal } from "./OutlineCardModal";
import { OutlineColumn } from "./OutlineColumn";

interface OutlineBoardProps {
  projectId: string;
}

/** Build a Record<columnId, cards[]> grouped and sorted by order. */
function groupCards(
  columnIds: string[],
  cards: OutlineCardType[],
): Record<string, OutlineCardType[]> {
  const map: Record<string, OutlineCardType[]> = {};
  for (const id of columnIds) {
    map[id] = [];
  }
  for (const card of cards) {
    if (map[card.columnId]) {
      map[card.columnId].push(card);
    }
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => a.order - b.order);
  }
  return map;
}

export function OutlineBoard({ projectId }: OutlineBoardProps) {
  const columns = useOutlineColumnsByProject(projectId);
  const cards = useOutlineCardsByProject(projectId);

  // Local state for optimistic drag
  const [localColumns, setLocalColumns] = useState(columns ?? []);
  const [localCardsByColumn, setLocalCardsByColumn] = useState<
    Record<string, OutlineCardType[]>
  >({});
  const previousColumns = useRef(localColumns);
  const previousCardsByColumn = useRef(localCardsByColumn);
  const isDragging = useRef(false);
  const dragType = useRef<"column" | "card" | null>(null);

  // Sync live queries -> local state (suppressed during drag)
  useEffect(() => {
    if (columns && !isDragging.current) {
      setLocalColumns(columns);
    }
  }, [columns]);

  useEffect(() => {
    if (columns && cards && !isDragging.current) {
      setLocalCardsByColumn(
        groupCards(
          columns.map((c) => c.id),
          cards,
        ),
      );
    }
  }, [columns, cards]);

  // Selected card for modal
  const [selectedCard, setSelectedCard] = useState<OutlineCardType | null>(
    null,
  );

  async function handleAddColumn() {
    await createOutlineColumn({ projectId, title: "New Column" });
  }

  return (
    <>
      <DragDropProvider
        onDragStart={(event) => {
          isDragging.current = true;
          previousColumns.current = localColumns;
          previousCardsByColumn.current = localCardsByColumn;
          const draggedId = event.operation.source?.id;
          const isColumn = localColumns.some((c) => c.id === draggedId);
          dragType.current = isColumn ? "column" : "card";
        }}
        onDragOver={(event) => {
          if (dragType.current === "column") {
            setLocalColumns((items) => move(items, event));
          } else {
            setLocalCardsByColumn((grouped) => move(grouped, event));
          }
        }}
        onDragEnd={async (event) => {
          isDragging.current = false;

          if (event.canceled) {
            setLocalColumns(previousColumns.current);
            setLocalCardsByColumn(previousCardsByColumn.current);
            dragType.current = null;
            return;
          }

          if (dragType.current === "column") {
            const orderedIds = localColumns.map((c) => c.id);
            await reorderOutlineColumns(orderedIds);
          } else {
            // Compute card positions from the grouped state
            const moves: { id: string; columnId: string; order: number }[] = [];
            for (const [columnId, colCards] of Object.entries(
              localCardsByColumn,
            )) {
              for (let i = 0; i < colCards.length; i++) {
                const card = colCards[i];
                if (card.columnId !== columnId || card.order !== i) {
                  moves.push({ id: card.id, columnId, order: i });
                }
              }
            }
            if (moves.length > 0) {
              await moveOutlineCards(moves);
            }
          }
          dragType.current = null;
        }}
      >
        <div className="flex gap-4 overflow-x-auto p-4">
          {localColumns.map((column, index) => (
            <OutlineColumn
              key={column.id}
              column={column}
              index={index}
              cards={localCardsByColumn[column.id] ?? []}
              onCardClick={(card) => setSelectedCard(card)}
            />
          ))}
          <button
            type="button"
            onClick={handleAddColumn}
            className="flex h-fit w-72 flex-shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-6 py-8 text-sm text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:text-zinc-400"
          >
            <Plus size={16} />
            Add Column
          </button>
        </div>
      </DragDropProvider>

      {selectedCard && (
        <OutlineCardModal
          card={selectedCard}
          projectId={projectId}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </>
  );
}
