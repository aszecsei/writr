"use client";

import { move } from "@dnd-kit/helpers";
import {
  DragDropProvider,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  CheckCircle2,
  Circle,
  CornerDownRight,
  Download,
  FileText,
  Pencil,
  Plus,
  SeparatorHorizontal,
  Settings,
  SplitSquareVertical,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DragHandle } from "@/components/bible/DragHandle";
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
import type {
  ChapterId,
  ChapterSection,
  ProjectId,
  Scene,
  SceneId,
} from "@/db/schemas";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { useBinderTree } from "@/hooks/data/useChapter";
import { useScenesByProject } from "@/hooks/data/useScene";
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
import {
  deleteSceneWithContent,
  moveSceneToChapter,
  promoteSceneToChapter,
  reorderScenesInChapter,
} from "@/lib/scenes/scene-surgery";
import { getTerm } from "@/lib/terminology";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";
import {
  BinderItem,
  BinderItemOverlay,
  type BinderItemShared,
  INDENT_PX,
} from "./BinderItem";
import { planSceneReorder } from "./scene-drag";

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

/** A 2px accent bar marking where a dragged scene will be inserted. */
function SceneDropLine({ indent }: { indent: number }) {
  return (
    <div
      className="pointer-events-none my-0.5 h-0.5 rounded-full bg-primary-500 dark:bg-primary-400"
      style={{ marginLeft: indent, marginRight: 12 }}
    />
  );
}

/**
 * A scene row rendered beneath an open chapter (Model D). Clicking navigates to
 * the chapter; right-click opens the scene context menu; the grip handle drags
 * it to reorder within its chapter or into another chapter. Local to
 * BinderSection so its function props don't cross a client-component boundary.
 */
function SceneRow({
  scene,
  index,
  depth,
  projectId,
  pathname,
  sceneTerm,
  onContextMenu,
  showLineBefore,
  showLineAfter,
}: {
  scene: Scene;
  index: number;
  depth: number;
  projectId: ProjectId;
  pathname: string;
  sceneTerm: string;
  onContextMenu: (e: React.MouseEvent, scene: Scene) => void;
  /** Render the insertion line immediately above this row. */
  showLineBefore: boolean;
  /** Render the insertion line immediately below this row (append slot). */
  showLineAfter: boolean;
}) {
  const requestSceneScroll = useEditorStore((s) => s.requestSceneScroll);
  const dragData = {
    type: "scene",
    sceneId: scene.id,
    chapterId: scene.chapterId,
  };
  const {
    ref: dragRef,
    handleRef,
    isDragSource,
  } = useDraggable({
    id: scene.id,
    type: "scene",
    data: dragData,
  });
  const { ref: dropRef } = useDroppable({
    id: scene.id,
    type: "scene",
    accept: "scene",
    data: dragData,
  });
  const setRef = useCallback(
    (el: Element | null) => {
      dragRef(el);
      dropRef(el);
    },
    [dragRef, dropRef],
  );
  const indent = (depth + 1) * INDENT_PX;
  const href = `/projects/${projectId}/chapters/${scene.chapterId}?scene=${scene.id}`;
  const isActive = pathname === href;
  const label = scene.title.trim() || `${sceneTerm} ${index + 1}`;
  return (
    <div>
      {showLineBefore && <SceneDropLine indent={indent} />}
      <div
        ref={setRef}
        className={`flex items-center rounded-md transition-colors ${
          isDragSource ? "opacity-40" : ""
        } ${
          isActive
            ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
        }`}
        style={{ paddingLeft: indent }}
      >
        <DragHandle ref={handleRef} />
        <Link
          href={href}
          onClick={() => requestSceneScroll(scene.id)}
          onContextMenu={(e) => onContextMenu(e, scene)}
          className="flex flex-1 items-center justify-between gap-2 overflow-hidden rounded-r-md py-density-item pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
        >
          <span className="truncate">{label}</span>
          <span className="ml-2 shrink-0 tabular-nums text-neutral-400 dark:text-neutral-500">
            {scene.wordCount.toLocaleString()}
          </span>
        </Link>
      </div>
      {showLineAfter && <SceneDropLine indent={indent} />}
    </div>
  );
}

interface BinderSectionLabels {
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
  const openChapters = useUiStore((s) => s.openChapters);
  const toggleChapterOpen = useUiStore((s) => s.toggleChapterOpen);
  const setChapterOpen = useUiStore((s) => s.setChapterOpen);
  const projectMode = useProjectStore((s) => s.activeProjectMode);
  const sceneTerm = getTerm(projectMode, "scene");
  const requestSceneScroll = useEditorStore((s) => s.requestSceneScroll);

  // Scene rows (Model D). Group the project's scenes by chapter so the binder
  // can interleave them under an open chapter and show a "N scenes" subtitle.
  const projectScenes = useScenesByProject(projectId);
  const { sceneCounts, scenesByChapter } = useMemo(() => {
    const counts = new Map<ChapterId, number>();
    const byChapter = new Map<ChapterId, typeof projectScenes>();
    for (const s of projectScenes ?? []) {
      counts.set(s.chapterId, (counts.get(s.chapterId) ?? 0) + 1);
      const bucket = byChapter.get(s.chapterId);
      if (bucket) bucket.push(s);
      else byChapter.set(s.chapterId, [s]);
    }
    for (const list of byChapter.values())
      list?.sort((a, b) => a.order - b.order);
    return { sceneCounts: counts, scenesByChapter: byChapter };
  }, [projectScenes]);

  // Default only the chapter being edited to "open"; others stay closed.
  const activeChapterId = useMemo(() => {
    const match = pathname.match(/\/chapters\/([^/?]+)/);
    return (match?.[1] as ChapterId | undefined) ?? null;
  }, [pathname]);
  useEffect(() => {
    if (activeChapterId && (sceneCounts.get(activeChapterId) ?? 0) > 1) {
      setChapterOpen(activeChapterId, true);
    }
  }, [activeChapterId, sceneCounts, setChapterOpen]);

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

  // Scene drag (Model D): the row being dragged plus the live drop slot. The
  // slot drives the insertion line and the target-chapter highlight, and is
  // read on drop to reorder within a chapter or move across chapters.
  const sceneDragRef = useRef<{
    sceneId: SceneId;
    originChapterId: ChapterId;
  } | null>(null);
  const [sceneDropTarget, setSceneDropTarget] = useState<{
    chapterId: ChapterId;
    beforeSceneId: SceneId | null;
  } | null>(null);

  useEffect(() => {
    if (!isDragging.current) setFlatRows(canonicalRows);
  }, [canonicalRows]);

  const [menuChapterId, setMenuChapterId] = useState<ChapterId | null>(null);
  const [menuScene, setMenuScene] = useState<Scene | null>(null);
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

  function handleSceneContextMenu(e: React.MouseEvent, scene: Scene) {
    e.preventDefault();
    setMenuChapterId(null);
    setMenuScene(scene);
    setMenuPos({ x: e.clientX, y: e.clientY });
  }

  function closeSceneMenu() {
    setMenuScene(null);
  }

  async function handleReorderScene(scene: Scene, direction: -1 | 1) {
    closeSceneMenu();
    const chapterScenes = scenesByChapter.get(scene.chapterId) ?? [];
    const from = chapterScenes.findIndex((s) => s.id === scene.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= chapterScenes.length) return;
    const ordered = chapterScenes.map((s) => s.id);
    [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
    await reorderScenesInChapter(scene.chapterId, ordered);
  }

  async function handleMoveSceneTo(scene: Scene, targetChapterId: ChapterId) {
    closeSceneMenu();
    await moveSceneToChapter(scene.id, targetChapterId);
  }

  async function handlePromoteScene(scene: Scene) {
    closeSceneMenu();
    const newChapterId = await promoteSceneToChapter(scene.id, labels.untitled);
    if (newChapterId) gotoChapter(newChapterId);
  }

  async function handleDeleteScene(scene: Scene) {
    closeSceneMenu();
    await deleteSceneWithContent(scene.id);
  }

  /** Persist a finished scene drag: reorder within the origin chapter, or move
   *  the scene into the target chapter and make that chapter active. */
  async function commitSceneDrag(
    sceneId: SceneId,
    originChapterId: ChapterId,
    target: { chapterId: ChapterId; beforeSceneId: SceneId | null },
  ) {
    try {
      if (target.chapterId === originChapterId) {
        const currentOrder = (scenesByChapter.get(originChapterId) ?? []).map(
          (s) => s.id,
        );
        const next = planSceneReorder(
          currentOrder,
          sceneId,
          target.beforeSceneId,
        );
        if (!next) return;
        await reorderScenesInChapter(originChapterId, next);
      } else {
        await moveSceneToChapter(
          sceneId,
          target.chapterId,
          target.beforeSceneId,
        );
        // The scene left its origin; make the target active and reveal it.
        router.push(`/projects/${projectId}/chapters/${target.chapterId}`);
        requestSceneScroll(sceneId);
      }
    } catch {
      // Stale / disallowed move — the live query keeps the canonical view.
    }
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
    sceneCounts,
    openChapters,
    onToggleChapterOpen: toggleChapterOpen,
    // Highlight the target chapter only for a cross-chapter scene drag.
    sceneDropTargetId:
      sceneDropTarget &&
      sceneDropTarget.chapterId !== sceneDragRef.current?.originChapterId
        ? sceneDropTarget.chapterId
        : null,
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
          const source = event.operation.source;
          if (source?.type === "scene") {
            sceneDragRef.current = {
              sceneId: source.id as SceneId,
              originChapterId: source.data.chapterId as ChapterId,
            };
            setSceneDropTarget(null);
            return;
          }
          const id = source?.id as ChapterId | undefined;
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
          if (source?.type === "scene") {
            event.preventDefault();
            if (!target) {
              setSceneDropTarget(null);
              return;
            }
            if (target.type === "scene") {
              const targetChapterId = target.data.chapterId as ChapterId;
              const targetSceneId = target.id as SceneId;
              const list = scenesByChapter.get(targetChapterId) ?? [];
              const idx = list.findIndex((s) => s.id === targetSceneId);
              // Drop before the hovered scene, or after it (before its
              // successor / at the end) once the pointer passes its midpoint.
              const pointerY = manager.dragOperation.position.current.y;
              const centerY = target.shape?.center.y ?? pointerY;
              const beforeSceneId =
                pointerY > centerY
                  ? (list[idx + 1]?.id ?? null)
                  : targetSceneId;
              setSceneDropTarget({ chapterId: targetChapterId, beforeSceneId });
            } else if (target.type === "chapter") {
              const chapterId = target.id as ChapterId;
              const chapter = nodeIndex.get(chapterId)?.chapter;
              if (chapter?.kind !== "document") {
                setSceneDropTarget(null);
                return;
              }
              // Reveal the chapter's scenes so the user can place among them.
              if (openChapters[chapterId] !== true)
                setChapterOpen(chapterId, true);
              setSceneDropTarget({ chapterId, beforeSceneId: null });
            } else {
              setSceneDropTarget(null);
            }
            return;
          }
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
        }}
        onDragEnd={async (event) => {
          const source = event.operation.source;
          if (source?.type === "scene") {
            const drag = sceneDragRef.current;
            const target = sceneDropTarget;
            sceneDragRef.current = null;
            setSceneDropTarget(null);
            if (event.canceled || !drag || !target) return;
            await commitSceneDrag(drag.sceneId, drag.originChapterId, target);
            return;
          }
          isDragging.current = false;
          const id = source?.id as ChapterId | undefined;
          if (event.canceled || !id) {
            setFlatRows(canonicalRows);
            return;
          }
          await commitDrag(flatRows, id);
        }}
      >
        <div className="space-y-0.5">
          {flatRows.map((row, index) => {
            const chapterScenes = scenesByChapter.get(row.chapter.id) ?? [];
            const showScenes =
              row.chapter.kind !== "separator" &&
              !row.hasChildren &&
              chapterScenes.length > 1 &&
              openChapters[row.chapter.id] === true;
            return (
              <div key={row.chapter.id} className="space-y-0.5">
                <BinderItem row={row} index={index} shared={shared} />
                {showScenes &&
                  chapterScenes.map((scene, sceneIndex) => (
                    <SceneRow
                      key={scene.id}
                      scene={scene}
                      index={sceneIndex}
                      depth={row.depth}
                      projectId={projectId}
                      pathname={pathname}
                      sceneTerm={sceneTerm}
                      onContextMenu={handleSceneContextMenu}
                      showLineBefore={
                        sceneDropTarget?.chapterId === row.chapter.id &&
                        sceneDropTarget.beforeSceneId === scene.id
                      }
                      showLineAfter={
                        sceneDropTarget?.chapterId === row.chapter.id &&
                        sceneDropTarget.beforeSceneId === null &&
                        sceneIndex === chapterScenes.length - 1
                      }
                    />
                  ))}
              </div>
            );
          })}
        </div>
        <DragOverlay>
          {(source) => {
            if (source.type === "scene") {
              const scene = (projectScenes ?? []).find(
                (s) => s.id === source.id,
              );
              return (
                <BinderItemOverlay title={scene?.title.trim() || sceneTerm} />
              );
            }
            return (
              <BinderItemOverlay
                title={
                  nodeIndex.get(source.id as ChapterId)?.chapter.title ?? ""
                }
              />
            );
          }}
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

      {menuScene && (
        <ContextMenu position={menuPos} onClose={closeSceneMenu}>
          <ContextMenuItem
            icon={ArrowUp}
            onClick={() => handleReorderScene(menuScene, -1)}
          >
            Move Up
          </ContextMenuItem>
          <ContextMenuItem
            icon={ArrowDown}
            onClick={() => handleReorderScene(menuScene, 1)}
          >
            Move Down
          </ContextMenuItem>
          <ContextMenuItem
            icon={SplitSquareVertical}
            onClick={() => handlePromoteScene(menuScene)}
          >
            Promote to {labels.add.replace(/^Add\s+/, "")}
          </ContextMenuItem>
          {(() => {
            const targets = [...nodeIndex.values()]
              .map((n) => n.chapter)
              .filter(
                (c) => c.kind !== "separator" && c.id !== menuScene.chapterId,
              );
            if (targets.length === 0) return null;
            return (
              <>
                <ContextMenuSeparator />
                <ContextMenuLabel>Move to</ContextMenuLabel>
                {targets.map((c) => (
                  <ContextMenuItem
                    key={c.id}
                    icon={ArrowRightLeft}
                    onClick={() => handleMoveSceneTo(menuScene, c.id)}
                  >
                    {c.title}
                  </ContextMenuItem>
                ))}
              </>
            );
          })()}
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={Trash2}
            variant="danger"
            onClick={() => handleDeleteScene(menuScene)}
          >
            Delete {sceneTerm}
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
