"use client";

import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  createChapter,
  createSeparator,
  deleteChapter,
  moveChapter,
  updateChapter,
} from "@/db/operations";
import type { ChapterId, ChapterSection, ProjectId, Scene } from "@/db/schemas";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { useBinderTree } from "@/hooks/data/useChapter";
import { useActiveProject } from "@/hooks/data/useProject";
import { useScenesByProject } from "@/hooks/data/useScene";
import { useBinderDragDrop } from "@/hooks/ui/useBinderDragDrop";
import { useBinderRename } from "@/hooks/ui/useBinderRename";
import { useSceneDragDrop } from "@/hooks/ui/useSceneDragDrop";
import { isNestingEnabled } from "@/lib/binder/config";
import {
  type BinderNode,
  flattenForDnd,
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
import { useUiStore } from "@/store/uiStore";
import { BinderContextMenu } from "./BinderContextMenu";
import {
  BinderItem,
  BinderItemOverlay,
  type BinderItemShared,
} from "./BinderItem";
import { SceneContextMenu } from "./SceneContextMenu";
import { SceneRow } from "./SceneRow";

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
  const openChapters = useUiStore((s) => s.openChapters);
  const toggleChapterOpen = useUiStore((s) => s.toggleChapterOpen);
  const setChapterOpen = useUiStore((s) => s.setChapterOpen);
  const projectMode = useActiveProject()?.mode ?? null;
  const sceneTerm = getTerm(projectMode, "scene");
  const sceneCountTerm = getTerm(projectMode, "scenes").toLowerCase();

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

  const chapterDrag = useBinderDragDrop({ canonicalRows, nestingEnabled });
  const sceneDrag = useSceneDragDrop({
    projectId,
    scenesByChapter,
    nodeIndex,
    openChapters,
    setChapterOpen,
  });
  const { flatRows } = chapterDrag;
  const { sceneDropTarget } = sceneDrag;

  const [menuChapterId, setMenuChapterId] = useState<ChapterId | null>(null);
  const [menuScene, setMenuScene] = useState<Scene | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [pendingDelete, setPendingDelete] = useState<{
    chapterId: ChapterId;
    chapterTitle: string;
    childCount: number;
  } | null>(null);

  const closeMenu = useCallback(() => setMenuChapterId(null), []);
  const rename = useBinderRename(closeMenu);

  function handleContextMenu(e: React.MouseEvent, chapterId: ChapterId) {
    e.preventDefault();
    setMenuChapterId(chapterId);
    setMenuPos({ x: e.clientX, y: e.clientY });
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

  function handleExport(chapterId: ChapterId) {
    closeMenu();
    openModal({ id: "export", projectId, chapterId, scope: "chapter" });
  }

  function handleEditSummary(chapterId: ChapterId) {
    closeMenu();
    openModal({ id: "chapter-properties", chapterId });
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
      setPendingDelete({
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
    if (!pendingDelete) return;
    const node = nodeIndex.get(pendingDelete.chapterId);
    const affected =
      mode === "cascade" && node
        ? descendantIds(node)
        : [pendingDelete.chapterId];
    await deleteChapter(pendingDelete.chapterId, mode);
    setPendingDelete(null);
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

  const shared: BinderItemShared = {
    projectId,
    pathname,
    subtreeTotals,
    subtreeHoles,
    collapsed,
    renamingChapterId: rename.renamingChapterId,
    renameValue: rename.renameValue,
    renameInputRef: rename.renameInputRef,
    onToggleCollapsed: toggleCollapsed,
    onRenameChange: rename.setRenameValue,
    onRenameCommit: rename.commitRename,
    onRenameKeyDown: rename.handleKeyDown,
    onContextMenu: handleContextMenu,
    onSeparatorOpen: (id) =>
      openModal({ id: "separator-settings", chapterId: id }),
    sceneCounts,
    sceneTerm: sceneCountTerm,
    openChapters,
    onToggleChapterOpen: toggleChapterOpen,
    sceneDropTargetId: sceneDrag.crossChapterDropTargetId,
  };

  const menuChapter = menuChapterId
    ? nodeIndex.get(menuChapterId)?.chapter
    : undefined;

  return (
    <div className="space-y-0.5">
      <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        {labels.header}
      </div>

      <DragDropProvider
        onDragStart={(event, manager) => {
          sceneDrag.onDragStart(event, manager);
          chapterDrag.onDragStart(event, manager);
        }}
        onDragOver={(event, manager) => {
          sceneDrag.onDragOver(event, manager);
          chapterDrag.onDragOver(event, manager);
        }}
        onDragMove={chapterDrag.onDragMove}
        onDragEnd={async (event, manager) => {
          await sceneDrag.onDragEnd(event, manager);
          await chapterDrag.onDragEnd(event, manager);
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
        <BinderContextMenu
          chapterId={menuChapterId}
          chapter={menuChapter}
          position={menuPos}
          labels={labels}
          nestingEnabled={nestingEnabled}
          onClose={closeMenu}
          onRenameStart={rename.startRename}
          onAddChild={handleAddChild}
          onAddSibling={handleAddSibling}
          onAddSeparator={handleAddSeparator}
          onMoveToOther={handleMoveToOther}
          onOpenSeparatorSettings={openSeparatorSettings}
          onExport={handleExport}
          onEditSummary={handleEditSummary}
          onSetStatus={handleSetStatus}
          onDelete={handleDelete}
        />
      )}

      {menuScene && (
        <SceneContextMenu
          scene={menuScene}
          position={menuPos}
          sceneTerm={sceneTerm}
          promoteLabel={labels.add.replace(/^Add\s+/, "")}
          nodeIndex={nodeIndex}
          onClose={closeSceneMenu}
          onReorder={handleReorderScene}
          onPromote={handlePromoteScene}
          onMoveTo={handleMoveSceneTo}
          onDelete={handleDeleteScene}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.chapterTitle}"?`}
          message={
            <>
              <strong>"{pendingDelete.chapterTitle}"</strong> contains{" "}
              {pendingDelete.childCount} nested{" "}
              {pendingDelete.childCount === 1 ? "item" : "items"}. Keep them by
              moving them up one level, or delete everything inside.
            </>
          }
          variant="danger"
          confirmLabel="Keep items (move up)"
          onConfirm={() => handleConfirmDelete("promote")}
          onCancel={() => setPendingDelete(null)}
          extraAction={{
            label: `Delete all (${pendingDelete.childCount + 1})`,
            onClick: () => handleConfirmDelete("cascade"),
          }}
        />
      )}
    </div>
  );
}
