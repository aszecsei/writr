import { move } from "@dnd-kit/helpers";
import type { DragDropEvents } from "@dnd-kit/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { syncReorderOutlineRows } from "@/db/operations";
import type { OutlineGridRow } from "@/db/schemas";

export function useOutlineGridDragDrop(rows: OutlineGridRow[] | undefined) {
  const [localRows, setLocalRows] = useState<OutlineGridRow[]>([]);
  const previousRows = useRef<OutlineGridRow[]>([]);
  const isDragging = useRef(false);

  // Sync live query -> local state (suppressed during drag)
  useEffect(() => {
    if (rows && !isDragging.current) {
      setLocalRows(rows);
    }
  }, [rows]);

  const onDragStart = useCallback(() => {
    isDragging.current = true;
    previousRows.current = localRows;
  }, [localRows]);

  const onDragOver: DragDropEvents["dragover"] = useCallback((event) => {
    setLocalRows((items) => move(items, event));
  }, []);

  const onDragEnd: DragDropEvents["dragend"] = useCallback(
    async (event) => {
      isDragging.current = false;
      if (event.canceled) {
        setLocalRows(previousRows.current);
        return;
      }
      const orderedIds = localRows.map((r) => r.id);
      await syncReorderOutlineRows(orderedIds);
    },
    [localRows],
  );

  return {
    localRows,
    onDragStart,
    onDragOver,
    onDragEnd,
  };
}
