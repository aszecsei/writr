import { useCallback } from "react";
import type { ContextMenuTarget } from "@/components/outline/OutlineGridContextMenu";
import {
  createChapterFromRow,
  createOutlineGridColumn,
  createOutlineGridRow,
  deleteOutlineGridColumn,
  insertOutlineGridColumnAt,
  insertOutlineGridRowAt,
  linkChapterToRow,
  syncDeleteOutlineRow,
  unlinkChapterFromRow,
  updateOutlineGridColumn,
  updateRowLabel,
  upsertOutlineGridCell,
} from "@/db/operations";
import type {
  OutlineCardColor,
  OutlineGridColumn,
  OutlineGridRow,
} from "@/db/schemas";

interface UseOutlineGridOperationsProps {
  projectId: string;
  localRows: OutlineGridRow[];
  columns: OutlineGridColumn[] | undefined;
  contextMenu: {
    position: { x: number; y: number };
    target: ContextMenuTarget;
  } | null;
  chapterMap: Map<string, { title: string; status: string }>;
  closeContextMenu: () => void;
  setDeleteConfirm: (
    confirm: {
      rowId: string;
      linkedChapterId: string;
      chapterTitle: string;
    } | null,
  ) => void;
}

export function useOutlineGridOperations({
  projectId,
  localRows,
  columns,
  contextMenu,
  chapterMap,
  closeContextMenu,
  setDeleteConfirm,
}: UseOutlineGridOperationsProps) {
  // Toolbar handlers
  const handleAddRow = useCallback(async () => {
    await createOutlineGridRow({ projectId });
  }, [projectId]);

  const handleAddColumn = useCallback(async () => {
    await createOutlineGridColumn({ projectId, title: "New Column" });
  }, [projectId]);

  // Column header handlers
  const handleRenameColumn = useCallback(
    async (columnId: string, title: string) => {
      await updateOutlineGridColumn(columnId, { title });
    },
    [],
  );

  // Row handlers
  const handleRowLabelChange = useCallback(
    async (rowId: string, label: string) => {
      await updateRowLabel(rowId, label);
    },
    [],
  );

  // Cell handlers
  const handleCellSave = useCallback(
    async (rowId: string, columnId: string, content: string) => {
      await upsertOutlineGridCell({ projectId, rowId, columnId, content });
    },
    [projectId],
  );

  // Helper to get row/column order
  const getRowOrder = useCallback(
    (rowId: string) => {
      return localRows.find((r) => r.id === rowId)?.order ?? 0;
    },
    [localRows],
  );

  const getColumnOrder = useCallback(
    (columnId: string) => {
      return columns?.find((c) => c.id === columnId)?.order ?? 0;
    },
    [columns],
  );

  // Insert operations
  const handleInsertRowAbove = useCallback(async () => {
    if (!contextMenu) return;
    const rowId =
      contextMenu.target.type === "cell"
        ? contextMenu.target.rowId
        : contextMenu.target.type === "row"
          ? contextMenu.target.rowId
          : null;
    if (rowId) {
      const order = getRowOrder(rowId);
      await insertOutlineGridRowAt(projectId, order);
    }
    closeContextMenu();
  }, [contextMenu, projectId, getRowOrder, closeContextMenu]);

  const handleInsertRowBelow = useCallback(async () => {
    if (!contextMenu) return;
    const rowId =
      contextMenu.target.type === "cell"
        ? contextMenu.target.rowId
        : contextMenu.target.type === "row"
          ? contextMenu.target.rowId
          : null;
    if (rowId) {
      const order = getRowOrder(rowId);
      await insertOutlineGridRowAt(projectId, order + 1);
    }
    closeContextMenu();
  }, [contextMenu, projectId, getRowOrder, closeContextMenu]);

  const handleInsertColumnLeft = useCallback(async () => {
    if (!contextMenu) return;
    const columnId =
      contextMenu.target.type === "cell"
        ? contextMenu.target.columnId
        : contextMenu.target.type === "column"
          ? contextMenu.target.columnId
          : null;
    if (columnId) {
      const order = getColumnOrder(columnId);
      await insertOutlineGridColumnAt(projectId, "New Column", order);
    }
    closeContextMenu();
  }, [contextMenu, projectId, getColumnOrder, closeContextMenu]);

  const handleInsertColumnRight = useCallback(async () => {
    if (!contextMenu) return;
    const columnId =
      contextMenu.target.type === "cell"
        ? contextMenu.target.columnId
        : contextMenu.target.type === "column"
          ? contextMenu.target.columnId
          : null;
    if (columnId) {
      const order = getColumnOrder(columnId);
      await insertOutlineGridColumnAt(projectId, "New Column", order + 1);
    }
    closeContextMenu();
  }, [contextMenu, projectId, getColumnOrder, closeContextMenu]);

  // Delete operations
  const handleDeleteRow = useCallback(async () => {
    if (!contextMenu) return;
    const rowId =
      contextMenu.target.type === "cell"
        ? contextMenu.target.rowId
        : contextMenu.target.type === "row"
          ? contextMenu.target.rowId
          : null;
    if (!rowId) {
      closeContextMenu();
      return;
    }

    // Check if row is linked to a chapter
    const row = localRows.find((r) => r.id === rowId);
    if (row?.linkedChapterId) {
      const chapterTitle =
        chapterMap.get(row.linkedChapterId)?.title || "Untitled";
      setDeleteConfirm({
        rowId,
        linkedChapterId: row.linkedChapterId,
        chapterTitle,
      });
      closeContextMenu();
      return;
    }

    await syncDeleteOutlineRow(rowId, false);
    closeContextMenu();
  }, [contextMenu, localRows, chapterMap, closeContextMenu, setDeleteConfirm]);

  const handleDeleteColumn = useCallback(async () => {
    if (!contextMenu) return;
    const columnId =
      contextMenu.target.type === "cell"
        ? contextMenu.target.columnId
        : contextMenu.target.type === "column"
          ? contextMenu.target.columnId
          : null;
    if (columnId) {
      await deleteOutlineGridColumn(columnId);
    }
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  const handleRenameColumnFromMenu = useCallback(() => {
    closeContextMenu();
  }, [closeContextMenu]);

  // Cell color
  const handleSetColor = useCallback(
    async (color: OutlineCardColor) => {
      if (!contextMenu || contextMenu.target.type !== "cell") return;
      const { rowId, columnId } = contextMenu.target;
      await upsertOutlineGridCell({ projectId, rowId, columnId, color });
    },
    [contextMenu, projectId],
  );

  // Chapter linking
  const handleLinkChapter = useCallback(
    async (chapterId: string) => {
      if (!contextMenu || contextMenu.target.type !== "row") return;
      const { rowId } = contextMenu.target;
      await linkChapterToRow(chapterId, rowId);
      closeContextMenu();
    },
    [contextMenu, closeContextMenu],
  );

  const handleUnlinkChapter = useCallback(async () => {
    if (!contextMenu || contextMenu.target.type !== "row") return;
    const { rowId } = contextMenu.target;
    await unlinkChapterFromRow(rowId);
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  const handleCreateChapter = useCallback(async () => {
    if (!contextMenu || contextMenu.target.type !== "row") return;
    const { rowId } = contextMenu.target;
    await createChapterFromRow(rowId, projectId);
    closeContextMenu();
  }, [contextMenu, projectId, closeContextMenu]);

  return {
    handleAddRow,
    handleAddColumn,
    handleRenameColumn,
    handleRowLabelChange,
    handleCellSave,
    handleInsertRowAbove,
    handleInsertRowBelow,
    handleInsertColumnLeft,
    handleInsertColumnRight,
    handleDeleteRow,
    handleDeleteColumn,
    handleRenameColumnFromMenu,
    handleSetColor,
    handleLinkChapter,
    handleUnlinkChapter,
    handleCreateChapter,
  };
}
