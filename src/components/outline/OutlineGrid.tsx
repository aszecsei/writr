"use client";

import { DragDropProvider } from "@dnd-kit/react";
import { useCallback, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { syncDeleteOutlineRow } from "@/db/operations";
import { useChaptersByProject } from "@/hooks/useChapter";
import {
  useOutlineGridCellsMap,
  useOutlineGridColumns,
  useOutlineGridRows,
} from "@/hooks/useOutlineGrid";
import { useOutlineGridDragDrop } from "@/hooks/useOutlineGridDragDrop";
import { useOutlineGridOperations } from "@/hooks/useOutlineGridOperations";
import {
  type ContextMenuTarget,
  OutlineGridContextMenu,
} from "./OutlineGridContextMenu";
import { OutlineGridHeader } from "./OutlineGridHeader";
import { OutlineGridRow } from "./OutlineGridRow";
import { OutlineGridToolbar } from "./OutlineGridToolbar";

interface OutlineGridProps {
  projectId: string;
  highlightCellId?: string | null;
}

export function OutlineGrid({ projectId, highlightCellId }: OutlineGridProps) {
  const columns = useOutlineGridColumns(projectId);
  const rows = useOutlineGridRows(projectId);
  const cellsMap = useOutlineGridCellsMap(projectId);
  const chapters = useChaptersByProject(projectId);

  // Drag and drop state
  const { localRows, onDragStart, onDragOver, onDragEnd } =
    useOutlineGridDragDrop(rows);

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

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Operations hook
  const operations = useOutlineGridOperations({
    projectId,
    localRows,
    columns,
    contextMenu,
    chapterMap,
    closeContextMenu,
    setDeleteConfirm,
  });

  // Context menu handler
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, target: ContextMenuTarget) => {
      e.preventDefault();
      setContextMenu({ position: { x: e.clientX, y: e.clientY }, target });
    },
    [],
  );

  // Delete confirmation handlers
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

  // Loading state
  if (!columns || !rows || !cellsMap) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-neutral-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-700">
        <OutlineGridToolbar
          onAddRow={operations.handleAddRow}
          onAddColumn={operations.handleAddColumn}
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <DragDropProvider
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20">
              <tr>
                {/* Row number/title header */}
                <th className="sticky left-0 z-30 min-w-[180px] border border-neutral-200 bg-neutral-100 px-3 py-2 text-left text-sm font-medium text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                  Chapter
                </th>
                {/* Status column header (fixed, non-editable) */}
                <th className="min-w-[90px] border border-neutral-200 bg-neutral-100 px-3 py-2 text-left text-sm font-medium text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                  Status
                </th>
                {columns.map((column) => (
                  <OutlineGridHeader
                    key={column.id}
                    column={column}
                    onRename={(title) =>
                      operations.handleRenameColumn(column.id, title)
                    }
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
                  highlightCellId={highlightCellId}
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
                    operations.handleRowLabelChange(row.id, label)
                  }
                  onCellSave={(columnId, content) =>
                    operations.handleCellSave(row.id, columnId, content)
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
          <div className="flex h-64 items-center justify-center text-neutral-500">
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
          onInsertRowAbove={operations.handleInsertRowAbove}
          onInsertRowBelow={operations.handleInsertRowBelow}
          onInsertColumnLeft={operations.handleInsertColumnLeft}
          onInsertColumnRight={operations.handleInsertColumnRight}
          onDeleteRow={operations.handleDeleteRow}
          onDeleteColumn={operations.handleDeleteColumn}
          onRenameColumn={operations.handleRenameColumnFromMenu}
          onSetColor={operations.handleSetColor}
          onLinkChapter={operations.handleLinkChapter}
          onUnlinkChapter={operations.handleUnlinkChapter}
          onCreateChapter={operations.handleCreateChapter}
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
