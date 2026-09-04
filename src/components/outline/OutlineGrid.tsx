"use client";

import { DragDropProvider } from "@dnd-kit/react";
import { useCallback, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { syncDeleteOutlineRow } from "@/db/operations";
import type {
  ChapterId,
  OutlineGridCellId,
  OutlineGridRowId,
  ProjectId,
} from "@/db/schemas";
import { useChaptersByProject } from "@/hooks/data/useChapter";
import {
  useOutlineGridCellsMap,
  useOutlineGridColumns,
  useOutlineGridRows,
} from "@/hooks/outline/useOutlineGrid";
import { useOutlineGridDragDrop } from "@/hooks/outline/useOutlineGridDragDrop";
import { useOutlineGridOperations } from "@/hooks/outline/useOutlineGridOperations";
import { depthMap, isManuscriptDocument } from "@/lib/binder/tree";
import {
  type ContextMenuTarget,
  OutlineGridContextMenu,
} from "./OutlineGridContextMenu";
import { OutlineGridHeader } from "./OutlineGridHeader";
import { OutlineGridRow } from "./OutlineGridRow";
import { OutlineGridToolbar } from "./OutlineGridToolbar";

interface OutlineGridProps {
  projectId: ProjectId;
  highlightCellId?: OutlineGridCellId | null;
}

export function OutlineGrid({ projectId, highlightCellId }: OutlineGridProps) {
  const columns = useOutlineGridColumns(projectId);
  const rows = useOutlineGridRows(projectId);
  const cellsMap = useOutlineGridCellsMap(projectId);
  const chapters = useChaptersByProject(projectId);

  const { localRows, onDragStart, onDragOver, onDragEnd } =
    useOutlineGridDragDrop(rows);

  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    target: ContextMenuTarget;
  } | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    rowId: OutlineGridRowId;
    linkedChapterId: ChapterId;
    chapterTitle: string;
  } | null>(null);

  // Only manuscript documents can be represented as outline rows — separators
  // and scratchpad docs are not chapters.
  const manuscriptChapters = useMemo(
    () => (chapters ?? []).filter(isManuscriptDocument),
    [chapters],
  );

  const chapterMap = useMemo(() => {
    return new Map(
      manuscriptChapters.map((c) => [
        c.id,
        { title: c.title, status: c.status },
      ]),
    );
  }, [manuscriptChapters]);

  // Nesting depth of each chapter, so linked rows can indent to mirror the binder.
  const chapterDepth = useMemo(() => depthMap(chapters ?? []), [chapters]);

  const availableChapters = useMemo(() => {
    if (!rows) return [];
    const linkedChapterIds = new Set(
      rows.filter((r) => r.linkedChapterId).map((r) => r.linkedChapterId),
    );
    return manuscriptChapters.filter((c) => !linkedChapterIds.has(c.id));
  }, [manuscriptChapters, rows]);

  const currentCellColor = useMemo(() => {
    if (contextMenu?.target.type !== "cell" || !cellsMap) {
      return undefined;
    }
    const { rowId, columnId } = contextMenu.target;
    return cellsMap.get(`${rowId}:${columnId}`)?.color;
  }, [contextMenu, cellsMap]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const operations = useOutlineGridOperations({
    projectId,
    localRows,
    columns,
    contextMenu,
    chapterMap,
    closeContextMenu,
    setDeleteConfirm,
  });

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, target: ContextMenuTarget) => {
      e.preventDefault();
      setContextMenu({ position: { x: e.clientX, y: e.clientY }, target });
    },
    [],
  );

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

  if (!columns || !rows || !cellsMap) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-neutral-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-700">
        <OutlineGridToolbar
          onAddRow={operations.handleAddRow}
          onAddColumn={operations.handleAddColumn}
        />
      </div>

      <div className="flex-1 overflow-auto">
        <DragDropProvider
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 min-w-[180px] border border-neutral-200 bg-neutral-100 px-3 py-2 text-left text-sm font-medium text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                  Chapter
                </th>
                {/* Fixed, non-editable */}
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
                  depth={
                    row.linkedChapterId
                      ? (chapterDepth.get(row.linkedChapterId) ?? 0)
                      : 0
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

        {localRows.length === 0 && columns.length === 0 && (
          <div className="flex h-64 items-center justify-center text-neutral-500">
            <p>
              Click "Add Row" and "Add Column" to start building your outline.
            </p>
          </div>
        )}
      </div>

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
