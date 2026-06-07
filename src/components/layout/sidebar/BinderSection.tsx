"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import {
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  CornerDownRight,
  Download,
  FileText,
  Pencil,
  Plus,
  SeparatorHorizontal,
  Settings,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@/components/ui/ContextMenu";
import {
  createChapter,
  createSeparator,
  deleteChapter,
  moveChapter,
  updateChapter,
} from "@/db/operations";
import type { ChapterId, ChapterSection, ProjectId } from "@/db/schemas";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { useBinderTree } from "@/hooks/data/useChapter";
import { isNestingEnabled } from "@/lib/binder/config";
import {
  type BinderNode,
  type FlatRow,
  flatDescendantIds,
  flattenForDnd,
  getBinderProjection,
  getDragDepth,
  subtreeHoleCounts,
  subtreeWordCounts,
} from "@/lib/binder/tree";
import { DEFAULT_HOLE_DELIMITERS } from "@/lib/holes";
import { useUiStore } from "@/store/uiStore";
import {
  BinderItem,
  BinderItemOverlay,
  type BinderItemShared,
  INDENT_PX,
} from "./BinderItem";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "revised", label: "Revised" },
  { value: "final", label: "Final" },
] as const;

function indexNodes(nodes: BinderNode[]): Map<ChapterId, BinderNode> {
  const map = new Map<ChapterId, BinderNode>();
  const walk = (list: BinderNode[]) => {
    for (const n of list) {
      map.set(n.chapter.id, n);
      walk(n.children);
    }
  };
  walk(nodes);
  return map;
}

function descendantIds(node: BinderNode): ChapterId[] {
  const ids: ChapterId[] = [node.chapter.id];
  for (const child of node.children) ids.push(...descendantIds(child));
  return ids;
}

export interface BinderSectionLabels {
  /** Uppercase section header, e.g. "Manuscript". */
  header: string;
  /** "Add" button + sibling menu label, e.g. "Add Chapter". */
  add: string;
  /** Label for the nested-add menu item, e.g. "Add Nested Chapter". */
  addNested: string;
  /** Default title for a newly created document, e.g. "Untitled Chapter". */
  untitled: string;
  /** Cross-section move label, e.g. "Move to Scratchpad". */
  moveToOther: string;
}

export function BinderSection({
  projectId,
  pathname,
  section,
  labels,
}: {
  projectId: ProjectId;
  pathname: string;
  section: ChapterSection;
  labels: BinderSectionLabels;
}) {
  // UI-only gate: hides "Add Nested…" and disables drag-to-nest. Existing
  // nested data still renders and compiles.
  const nestingEnabled = isNestingEnabled();
  const otherSection: ChapterSection =
    section === "manuscript" ? "scratchpad" : "manuscript";
  const tree = useBinderTree(projectId, section);
  const settings = useAppSettings();
  const router = useRouter();
  const openModal = useUiStore((s) => s.openModal);
  const collapsed = useUiStore((s) => s.collapsedChapters);
  const toggleCollapsed = useUiStore((s) => s.toggleChapterCollapsed);
  const setCollapsed = useUiStore((s) => s.setChapterCollapsed);

  const subtreeTotals = useMemo(() => subtreeWordCounts(tree), [tree]);
  const holeDelimiters = settings?.holeDelimiters ?? DEFAULT_HOLE_DELIMITERS;
  const subtreeHoles = useMemo(
    () => subtreeHoleCounts(tree, holeDelimiters),
    [tree, holeDelimiters],
  );
  const nodeIndex = useMemo(() => indexNodes(tree), [tree]);
  const canonicalRows = useMemo(
    () => flattenForDnd(tree, collapsed),
    [tree, collapsed],
  );

  // Optimistic flattened list driven during a drag (ported from the dnd-kit
  // Sortable/Tree example): `move()` reorders it and horizontal projection sets
  // each dragged row's depth/parentId. While idle it tracks `canonicalRows`.
  const [flatRows, setFlatRows] = useState<FlatRow[]>(canonicalRows);
  const isDragging = useRef(false);
  const initialDepth = useRef(0);

  useEffect(() => {
    if (!isDragging.current) setFlatRows(canonicalRows);
  }, [canonicalRows]);

  const [menuChapterId, setMenuChapterId] = useState<ChapterId | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [renamingChapterId, setRenamingChapterId] = useState<ChapterId | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    chapterId: ChapterId;
    chapterTitle: string;
    childCount: number;
  } | null>(null);

  const closeMenu = useCallback(() => setMenuChapterId(null), []);

  useEffect(() => {
    if (renamingChapterId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingChapterId]);

  function handleContextMenu(e: React.MouseEvent, chapterId: ChapterId) {
    e.preventDefault();
    setMenuChapterId(chapterId);
    setMenuPos({ x: e.clientX, y: e.clientY });
  }

  function handleRenameStart(chapterId: ChapterId, currentTitle: string) {
    setRenamingChapterId(chapterId);
    setRenameValue(currentTitle);
    closeMenu();
  }

  async function handleRenameCommit() {
    if (renamingChapterId && renameValue.trim()) {
      await updateChapter(renamingChapterId, { title: renameValue.trim() });
    }
    setRenamingChapterId(null);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleRenameCommit();
    else if (e.key === "Escape") setRenamingChapterId(null);
  }

  async function handleSetStatus(
    chapterId: ChapterId,
    status: "draft" | "revised" | "final",
  ) {
    await updateChapter(chapterId, { status });
    closeMenu();
  }

  function gotoChapter(id: ChapterId) {
    router.push(`/projects/${projectId}/chapters/${id}`);
  }

  async function handleAdd() {
    const ch = await createChapter({
      projectId,
      title: labels.untitled,
      section,
    });
    gotoChapter(ch.id);
  }

  async function handleAddChild(parentId: ChapterId) {
    closeMenu();
    const ch = await createChapter({
      projectId,
      title: labels.untitled,
      section,
      parentChapterId: parentId,
    });
    setCollapsed(parentId, false);
    gotoChapter(ch.id);
  }

  async function handleAddSibling(chapterId: ChapterId) {
    closeMenu();
    const sibling = nodeIndex.get(chapterId)?.chapter;
    const ch = await createChapter({
      projectId,
      title: labels.untitled,
      section,
      parentChapterId: sibling?.parentChapterId ?? null,
    });
    gotoChapter(ch.id);
  }

  async function handleAddSeparator(chapterId: ChapterId) {
    closeMenu();
    const sibling = nodeIndex.get(chapterId)?.chapter;
    await createSeparator({
      projectId,
      title: "Part",
      section,
      parentChapterId: sibling?.parentChapterId ?? null,
    });
  }

  async function handleMoveToOther(chapterId: ChapterId) {
    closeMenu();
    await moveChapter(chapterId, {
      parentChapterId: null,
      section: otherSection,
    });
  }

  function openSeparatorSettings(chapterId: ChapterId) {
    closeMenu();
    openModal({ id: "separator-settings", chapterId });
  }

  function navigateAwayIfDeleted(deletedIds: ChapterId[]) {
    const active = deletedIds.find(
      (id) => pathname === `/projects/${projectId}/chapters/${id}`,
    );
    if (active) router.push(`/projects/${projectId}`);
  }

  async function handleDelete(chapterId: ChapterId) {
    closeMenu();
    const node = nodeIndex.get(chapterId);
    if (!node) return;
    if (node.children.length > 0) {
      setDeleteConfirm({
        chapterId,
        chapterTitle: node.chapter.title,
        childCount: descendantIds(node).length - 1,
      });
      return;
    }
    await deleteChapter(chapterId, "cascade");
    navigateAwayIfDeleted([chapterId]);
  }

  async function handleConfirmDelete(mode: "cascade" | "promote") {
    if (!deleteConfirm) return;
    const node = nodeIndex.get(deleteConfirm.chapterId);
    const affected =
      mode === "cascade" && node
        ? descendantIds(node)
        : [deleteConfirm.chapterId];
    await deleteChapter(deleteConfirm.chapterId, mode);
    setDeleteConfirm(null);
    navigateAwayIfDeleted(affected);
  }

  const shared: BinderItemShared = {
    projectId,
    pathname,
    subtreeTotals,
    subtreeHoles,
    collapsed,
    renamingChapterId,
    renameValue,
    renameInputRef,
    onToggleCollapsed: toggleCollapsed,
    onRenameChange: setRenameValue,
    onRenameCommit: handleRenameCommit,
    onRenameKeyDown: handleRenameKeyDown,
    onContextMenu: handleContextMenu,
    onSeparatorOpen: (id) =>
      openModal({ id: "separator-settings", chapterId: id }),
  };

  const menuChapter = menuChapterId
    ? nodeIndex.get(menuChapterId)?.chapter
    : undefined;
  const isMenuDocument = menuChapter?.kind !== "separator";

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

  return (
    <div className="space-y-0.5">
      <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        {labels.header}
      </div>

      <DragDropProvider
        onDragStart={(event) => {
          const id = event.operation.source?.id as ChapterId | undefined;
          if (!id) return;
          isDragging.current = true;
          const start = flatRows.find((r) => r.chapter.id === id);
          initialDepth.current = start?.depth ?? 0;
          // Hide the dragged row's descendants for the duration of the drag.
          const descendants = flatDescendantIds(flatRows, id);
          setFlatRows((rows) =>
            rows.filter((r) => !descendants.has(r.chapter.id)),
          );
        }}
        onDragOver={(event, manager) => {
          const { source, target } = event.operation;
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
        }}
        onDragMove={(event, manager) => {
          if (event.defaultPrevented) return;
          const { source } = event.operation;
          if (!source) return;
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
        }}
        onDragEnd={async (event) => {
          isDragging.current = false;
          const id = event.operation.source?.id as ChapterId | undefined;
          if (event.canceled || !id) {
            setFlatRows(canonicalRows);
            return;
          }
          await commitDrag(flatRows, id);
        }}
      >
        <div className="space-y-0.5">
          {flatRows.map((row, index) => (
            <BinderItem
              key={row.chapter.id}
              row={row}
              index={index}
              shared={shared}
            />
          ))}
        </div>
        <DragOverlay>
          {(source) => (
            <BinderItemOverlay
              title={nodeIndex.get(source.id as ChapterId)?.chapter.title ?? ""}
            />
          )}
        </DragOverlay>
      </DragDropProvider>

      <button
        type="button"
        onClick={handleAdd}
        className="flex w-full items-center gap-2 rounded-md px-3 py-density-item text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-300"
      >
        <Plus size={14} />
        {labels.add}
      </button>

      {menuChapterId && (
        <ContextMenu position={menuPos} onClose={closeMenu}>
          <ContextMenuItem
            icon={Pencil}
            onClick={() => {
              if (menuChapter)
                handleRenameStart(menuChapter.id, menuChapter.title);
            }}
          >
            Rename
          </ContextMenuItem>
          {isMenuDocument && nestingEnabled && (
            <ContextMenuItem
              icon={CornerDownRight}
              onClick={() => handleAddChild(menuChapterId)}
            >
              {labels.addNested}
            </ContextMenuItem>
          )}
          <ContextMenuItem
            icon={Plus}
            onClick={() => handleAddSibling(menuChapterId)}
          >
            {labels.add}
          </ContextMenuItem>
          <ContextMenuItem
            icon={SeparatorHorizontal}
            onClick={() => handleAddSeparator(menuChapterId)}
          >
            Add Separator
          </ContextMenuItem>
          <ContextMenuItem
            icon={ArrowRightLeft}
            onClick={() => handleMoveToOther(menuChapterId)}
          >
            {labels.moveToOther}
          </ContextMenuItem>
          {!isMenuDocument && (
            <ContextMenuItem
              icon={Settings}
              onClick={() => openSeparatorSettings(menuChapterId)}
            >
              Separator Settings
            </ContextMenuItem>
          )}
          {isMenuDocument && (
            <>
              <ContextMenuItem
                icon={Download}
                onClick={() => {
                  closeMenu();
                  openModal({
                    id: "export",
                    projectId,
                    chapterId: menuChapterId,
                    scope: "chapter",
                  });
                }}
              >
                Export
              </ContextMenuItem>
              <ContextMenuItem
                icon={FileText}
                onClick={() => {
                  closeMenu();
                  openModal({
                    id: "chapter-properties",
                    chapterId: menuChapterId,
                  });
                }}
              >
                Edit Summary
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuLabel>Status</ContextMenuLabel>
              {STATUS_OPTIONS.map((opt) => {
                const isCurrent = menuChapter?.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                      isCurrent
                        ? "font-medium text-neutral-900 dark:text-neutral-100"
                        : "text-neutral-700 dark:text-neutral-300"
                    } hover:bg-neutral-100 dark:hover:bg-neutral-800`}
                    onClick={() => handleSetStatus(menuChapterId, opt.value)}
                  >
                    {isCurrent ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <Circle size={14} />
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={Trash2}
            variant="danger"
            onClick={() => handleDelete(menuChapterId)}
          >
            Delete
          </ContextMenuItem>
        </ContextMenu>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title={`Delete "${deleteConfirm.chapterTitle}"?`}
          message={
            <>
              <strong>"{deleteConfirm.chapterTitle}"</strong> contains{" "}
              {deleteConfirm.childCount} nested{" "}
              {deleteConfirm.childCount === 1 ? "item" : "items"}. Keep them by
              moving them up one level, or delete everything inside.
            </>
          }
          variant="danger"
          confirmLabel="Keep items (move up)"
          onConfirm={() => handleConfirmDelete("promote")}
          onCancel={() => setDeleteConfirm(null)}
          extraAction={{
            label: `Delete all (${deleteConfirm.childCount + 1})`,
            onClick: () => handleConfirmDelete("cascade"),
          }}
        />
      )}
    </div>
  );
}
