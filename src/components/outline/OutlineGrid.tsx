"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  createChapterFromRow,
  createOutlineGridColumn,
  createOutlineGridRow,
  deleteOutlineGridColumn,
  insertOutlineGridColumnAt,
  insertOutlineGridRowAt,
  linkChapterToRow,
  syncDeleteOutlineRow,
  syncReorderOutlineRows,
  unlinkChapterFromRow,
  updateOutlineGridColumn,
  updateRowLabel,
  upsertOutlineGridCell,
} from "@/db/operations";
import type {
  OutlineGridRow as GridRowType,
  OutlineCardColor,
} from "@/db/schemas";
import { useChaptersByProject } from "@/hooks/useChapter";
import {
  useOutlineGridCellsMap,
  useOutlineGridColumns,
  useOutlineGridRows,
} from "@/hooks/useOutlineGrid";
import {
  type ContextMenuTarget,
  OutlineGridContextMenu,
} from "./OutlineGridContextMenu";
import { OutlineGridHeader } from "./OutlineGridHeader";
import { OutlineGridRow } from "./OutlineGridRow";
import { OutlineGridToolbar } from "./OutlineGridToolbar";

interface OutlineGridProps {
  projectId: string;
}

export function OutlineGrid({ projectId }: OutlineGridProps) {
  const columns = useOutlineGridColumns(projectId);
  const rows = useOutlineGridRows(projectId);
  const cellsMap = useOutlineGridCellsMap(projectId);
  const chapters = useChaptersByProject(projectId);

  // Local state for optimistic drag reordering
  const [localRows, setLocalRows] = useState<GridRowType[]>([]);
  const previousRows = useRef<GridRowType[]>([]);
  const isDragging = useRef(false);

  // Sync live query -> local state (suppressed during drag)
  useEffect(() => {
    if (rows && !isDragging.current) {
      setLocalRows(rows);
    }
  }, [rows]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    target: ContextMenuTarget;
  } | null>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    rowId: string;
    linkedChapterId: string;
    chapterTitle: string;
  } | null>(null);

  // Build chapter lookup map (id -> { title, status })
  const chapterMap = useMemo(() => {
    if (!chapters) return new Map<string, { title: string; status: string }>();
    return new Map(
      chapters.map((c) => [c.id, { title: c.title, status: c.status }]),
    );
  }, [chapters]);

  // Get chapters not already linked to a row (for linking menu)
  const availableChapters = useMemo(() => {
    if (!chapters || !rows) return [];
    const linkedChapterIds = new Set(
      rows.filter((r) => r.linkedChapterId).map((r) => r.linkedChapterId),
    );
    return chapters.filter((c) => !linkedChapterIds.has(c.id));
  }, [chapters, rows]);

  // Get current cell color for context menu
  const currentCellColor = useMemo(() => {
    if (!contextMenu || contextMenu.target.type !== "cell" || !cellsMap) {
      return undefined;
    }
    const { rowId, columnId } = contextMenu.target;
    return cellsMap.get(`${rowId}:${columnId}`)?.color;
  }, [contextMenu, cellsMap]);

  // Handlers for toolbar
  const handleAddRow = useCallback(async () => {
    await createOutlineGridRow({ projectId });
  }, [projectId]);

  const handleAddColumn = useCallback(async () => {
    await createOutlineGridColumn({ projectId, title: "New Column" });
  }, [projectId]);

  // Handlers for column header
  const handleRenameColumn = useCallback(
    async (columnId: string, title: string) => {
      await updateOutlineGridColumn(columnId, { title });
    },
    [],
  );

  // Handlers for row - sync is automatic via updateRowLabel
  const handleRowLabelChange = useCallback(
    async (rowId: string, label: string) => {
      await updateRowLabel(rowId, label);
    },
    [],
  );

  // Handler for cell save
  const handleCellSave = useCallback(
    async (rowId: string, columnId: string, content: string) => {
      await upsertOutlineGridCell({ projectId, rowId, columnId, content });
    },
    [projectId],
  );

  // Context menu handlers
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, target: ContextMenuTarget) => {
      e.preventDefault();
      setContextMenu({ position: { x: e.clientX, y: e.clientY }, target });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Get the row/column for context menu operations
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

  // Context menu actions
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
  }, [contextMenu, localRows, chapterMap, closeContextMenu]);

  const handleConfirmDeleteRow = useCallback(async () => {
    if (!deleteConfirm) return;
    await syncDeleteOutlineRow(deleteConfirm.rowId, false);
    setDeleteConfirm(null);
  }, [deleteConfirm]);

  const handleConfirmDeleteRowAndChapter = useCallback(async () => {
    if (!deleteConfirm) return;
    await syncDeleteOutlineRow(deleteConfirm.rowId, true);
    setDeleteConfirm(null);
  }, [deleteConfirm]);

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

  const handleSetColor = useCallback(
    async (color: OutlineCardColor) => {
      if (!contextMenu || contextMenu.target.type !== "cell") return;
      const { rowId, columnId } = contextMenu.target;
      await upsertOutlineGridCell({ projectId, rowId, columnId, color });
    },
    [contextMenu, projectId],
  );

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

  // Loading state
  if (!columns || !rows || !cellsMap) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
        <OutlineGridToolbar
          onAddRow={handleAddRow}
          onAddColumn={handleAddColumn}
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <DragDropProvider
          onDragStart={() => {
            isDragging.current = true;
            previousRows.current = localRows;
          }}
          onDragOver={(event) => {
            setLocalRows((items) => move(items, event));
          }}
          onDragEnd={async (event) => {
            isDragging.current = false;
            if (event.canceled) {
              setLocalRows(previousRows.current);
              return;
            }
            const orderedIds = localRows.map((r) => r.id);
            await syncReorderOutlineRows(orderedIds);
          }}
        >
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20">
              <tr>
                {/* Row number/title header */}
                <th className="sticky left-0 z-30 min-w-[180px] border border-zinc-200 bg-zinc-100 px-3 py-2 text-left text-sm font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  Chapter
                </th>
                {/* Status column header (fixed, non-editable) */}
                <th className="min-w-[90px] border border-zinc-200 bg-zinc-100 px-3 py-2 text-left text-sm font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  Status
                </th>
                {columns.map((column) => (
                  <OutlineGridHeader
                    key={column.id}
                    column={column}
                    onRename={(title) => handleRenameColumn(column.id, title)}
                    onContextMenu={(e) =>
                      handleContextMenu(e, {
                        type: "column",
                        columnId: column.id,
                      })
                    }
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {localRows.map((row, index) => (
                <OutlineGridRow
                  key={row.id}
                  row={row}
                  index={index}
                  columns={columns}
                  cellsMap={cellsMap}
                  chapterTitle={
                    row.linkedChapterId
                      ? chapterMap.get(row.linkedChapterId)?.title
                      : undefined
                  }
                  chapterStatus={
                    row.linkedChapterId
                      ? chapterMap.get(row.linkedChapterId)?.status
                      : undefined
                  }
                  onRowLabelChange={(label) =>
                    handleRowLabelChange(row.id, label)
                  }
                  onCellSave={(columnId, content) =>
                    handleCellSave(row.id, columnId, content)
                  }
                  onRowContextMenu={(e) =>
                    handleContextMenu(e, {
                      type: "row",
                      rowId: row.id,
                      linkedChapterId: row.linkedChapterId,
                    })
                  }
                  onCellContextMenu={(e, columnId) =>
                    handleContextMenu(e, {
                      type: "cell",
                      rowId: row.id,
                      columnId,
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        </DragDropProvider>

        {/* Empty state */}
        {localRows.length === 0 && columns.length === 0 && (
          <div className="flex h-64 items-center justify-center text-zinc-500">
            <p>
              Click "Add Row" and "Add Column" to start building your outline.
            </p>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <OutlineGridContextMenu
          position={contextMenu.position}
          target={contextMenu.target}
          currentColor={currentCellColor}
          availableChapters={availableChapters}
          onClose={closeContextMenu}
          onInsertRowAbove={handleInsertRowAbove}
          onInsertRowBelow={handleInsertRowBelow}
          onInsertColumnLeft={handleInsertColumnLeft}
          onInsertColumnRight={handleInsertColumnRight}
          onDeleteRow={handleDeleteRow}
          onDeleteColumn={handleDeleteColumn}
          onRenameColumn={handleRenameColumnFromMenu}
          onSetColor={handleSetColor}
          onLinkChapter={handleLinkChapter}
          onUnlinkChapter={handleUnlinkChapter}
          onCreateChapter={handleCreateChapter}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete linked row?"
          message={
            <>
              This row is linked to the chapter{" "}
              <strong>"{deleteConfirm.chapterTitle}"</strong>. You can delete
              just the row or delete both the row and chapter.
            </>
          }
          variant="danger"
          confirmLabel="Delete row only"
          onConfirm={handleConfirmDeleteRow}
          onCancel={() => setDeleteConfirm(null)}
          extraAction={{
            label: "Delete row and chapter",
            onClick: handleConfirmDeleteRowAndChapter,
          }}
        />
      )}
    </div>
  );
}
