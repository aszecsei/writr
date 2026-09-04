"use client";

import { move } from "@dnd-kit/helpers";
import type { DragDropProvider } from "@dnd-kit/react";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import { INDENT_PX } from "@/components/layout/sidebar/BinderItem";
import { moveChapter } from "@/db/operations";
import type { ChapterId } from "@/db/schemas";
import {
  type FlatRow,
  flatDescendantIds,
  getBinderProjection,
  getDragDepth,
} from "@/lib/binder/tree";

type DragStartHandler = NonNullable<
  ComponentProps<typeof DragDropProvider>["onDragStart"]
>;
type DragMoveHandler = NonNullable<
  ComponentProps<typeof DragDropProvider>["onDragMove"]
>;
type DragOverHandler = NonNullable<
  ComponentProps<typeof DragDropProvider>["onDragOver"]
>;
type DragEndHandler = NonNullable<
  ComponentProps<typeof DragDropProvider>["onDragEnd"]
>;

/**
 * Chapter-tree drag-and-drop: an optimistic flattened list (ported from the
 * dnd-kit Sortable/Tree example) that `move()` reorders and horizontal
 * projection re-depths, committed to `moveChapter` on drop. Ignores scene
 * drag sources entirely — `useSceneDragDrop` owns those.
 */
export function useBinderDragDrop({
  canonicalRows,
  nestingEnabled,
}: {
  canonicalRows: FlatRow[];
  nestingEnabled: boolean;
}) {
  const [flatRows, setFlatRows] = useState<FlatRow[]>(canonicalRows);
  const isDragging = useRef(false);
  const initialDepth = useRef(0);

  useEffect(() => {
    if (!isDragging.current) setFlatRows(canonicalRows);
  }, [canonicalRows]);

  /** Persist a finished drag: re-parent the dragged row and order it by its
   *  position in the optimistic flattened list. moveChapter carries the subtree. */
  async function commitDrag(rows: FlatRow[], id: ChapterId) {
    const index = rows.findIndex((r) => r.chapter.id === id);
    if (index === -1) return;
    const parentChapterId = rows[index].parentId;
    let beforeId: ChapterId | null = null;
    for (let i = index + 1; i < rows.length; i++) {
      if (rows[i].parentId === parentChapterId) {
        beforeId = rows[i].chapter.id;
        break;
      }
    }
    try {
      await moveChapter(id, { parentChapterId, beforeId });
    } catch {
      // Stale / cyclic move — the live query keeps the canonical view.
    }
  }

  const onDragStart: DragStartHandler = (event) => {
    const source = event.operation.source;
    if (source?.type === "scene") return;
    const id = source?.id as ChapterId | undefined;
    if (!id) return;
    isDragging.current = true;
    const start = flatRows.find((r) => r.chapter.id === id);
    initialDepth.current = start?.depth ?? 0;
    // Hide the dragged row's descendants for the duration of the drag.
    const descendants = flatDescendantIds(flatRows, id);
    setFlatRows((rows) => rows.filter((r) => !descendants.has(r.chapter.id)));
  };

  const onDragOver: DragOverHandler = (event, manager) => {
    const { source, target } = event.operation;
    if (source?.type === "scene") return;
    event.preventDefault();
    if (!source || !target || source.id === target.id) return;
    setFlatRows((rows) => {
      const sorted = move(rows, event);
      // Horizontal drag-to-nest is gated; when off, depth follows drop
      // position only (no intentional re-parenting).
      const dragDepth = nestingEnabled
        ? getDragDepth(manager.dragOperation.transform.x, INDENT_PX)
        : 0;
      const projectedDepth = initialDepth.current + dragDepth;
      const { depth, parentId } = getBinderProjection(
        sorted,
        source.id as ChapterId,
        projectedDepth,
      );
      return sorted.map((r) =>
        r.chapter.id === source.id ? { ...r, depth, parentId } : r,
      );
    });
  };

  const onDragMove: DragMoveHandler = (event, manager) => {
    if (event.defaultPrevented) return;
    const { source } = event.operation;
    if (!source || source.type === "scene") return;
    setFlatRows((rows) => {
      const dragDepth = nestingEnabled
        ? getDragDepth(manager.dragOperation.transform.x, INDENT_PX)
        : 0;
      const projectedDepth = initialDepth.current + dragDepth;
      const { depth, parentId } = getBinderProjection(
        rows,
        source.id as ChapterId,
        projectedDepth,
      );
      return rows.map((r) =>
        r.chapter.id === source.id ? { ...r, depth, parentId } : r,
      );
    });
  };

  const onDragEnd: DragEndHandler = async (event) => {
    const source = event.operation.source;
    if (source?.type === "scene") return;
    isDragging.current = false;
    const id = source?.id as ChapterId | undefined;
    if (event.canceled || !id) {
      setFlatRows(canonicalRows);
      return;
    }
    await commitDrag(flatRows, id);
  };

  return { flatRows, onDragStart, onDragOver, onDragMove, onDragEnd };
}
