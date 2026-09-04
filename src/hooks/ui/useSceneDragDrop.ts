"use client";

import type { DragDropProvider } from "@dnd-kit/react";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useRef, useState } from "react";
import { planSceneReorder } from "@/components/layout/sidebar/scene-drag";
import type { ChapterId, ProjectId, Scene, SceneId } from "@/db/schemas";
import type { BinderNode } from "@/lib/binder/tree";
import {
  moveSceneToChapter,
  reorderScenesInChapter,
} from "@/lib/scenes/scene-surgery";
import { useEditorStore } from "@/store/editorStore";

type DragStartHandler = NonNullable<
  ComponentProps<typeof DragDropProvider>["onDragStart"]
>;
type DragOverHandler = NonNullable<
  ComponentProps<typeof DragDropProvider>["onDragOver"]
>;
type DragEndHandler = NonNullable<
  ComponentProps<typeof DragDropProvider>["onDragEnd"]
>;

export interface SceneDropTarget {
  chapterId: ChapterId;
  beforeSceneId: SceneId | null;
}

/**
 * Scene drag (Model D): the row being dragged plus the live drop slot. The
 * slot drives the insertion line and the target-chapter highlight, and is
 * read on drop to reorder within a chapter or move across chapters. Ignores
 * chapter drag sources entirely — `useBinderDragDrop` owns those.
 */
export function useSceneDragDrop({
  projectId,
  scenesByChapter,
  nodeIndex,
  openChapters,
  setChapterOpen,
}: {
  projectId: ProjectId;
  scenesByChapter: Map<ChapterId, Scene[] | undefined>;
  nodeIndex: Map<ChapterId, BinderNode>;
  openChapters: Record<string, boolean>;
  setChapterOpen: (id: ChapterId, open: boolean) => void;
}) {
  const router = useRouter();
  const requestSceneScroll = useEditorStore((s) => s.requestSceneScroll);
  const sceneDragRef = useRef<{
    sceneId: SceneId;
    originChapterId: ChapterId;
  } | null>(null);
  const [sceneDropTarget, setSceneDropTarget] =
    useState<SceneDropTarget | null>(null);

  /** Persist a finished scene drag: reorder within the origin chapter, or move
   *  the scene into the target chapter and make that chapter active. */
  async function commitSceneDrag(
    sceneId: SceneId,
    originChapterId: ChapterId,
    target: SceneDropTarget,
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

  const onDragStart: DragStartHandler = (event) => {
    const source = event.operation.source;
    if (source?.type !== "scene") return;
    sceneDragRef.current = {
      sceneId: source.id as SceneId,
      originChapterId: source.data.chapterId as ChapterId,
    };
    setSceneDropTarget(null);
  };

  const onDragOver: DragOverHandler = (event, manager) => {
    const { source, target } = event.operation;
    if (source?.type !== "scene") return;
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
        pointerY > centerY ? (list[idx + 1]?.id ?? null) : targetSceneId;
      setSceneDropTarget({ chapterId: targetChapterId, beforeSceneId });
    } else if (target.type === "chapter") {
      const chapterId = target.id as ChapterId;
      const chapter = nodeIndex.get(chapterId)?.chapter;
      if (chapter?.kind !== "document") {
        setSceneDropTarget(null);
        return;
      }
      // Reveal the chapter's scenes so the user can place among them.
      if (openChapters[chapterId] !== true) setChapterOpen(chapterId, true);
      setSceneDropTarget({ chapterId, beforeSceneId: null });
    } else {
      setSceneDropTarget(null);
    }
  };

  const onDragEnd: DragEndHandler = async (event) => {
    const source = event.operation.source;
    if (source?.type !== "scene") return;
    const drag = sceneDragRef.current;
    const target = sceneDropTarget;
    sceneDragRef.current = null;
    setSceneDropTarget(null);
    if (event.canceled || !drag || !target) return;
    await commitSceneDrag(drag.sceneId, drag.originChapterId, target);
  };

  // Highlight the target chapter only for a cross-chapter scene drag.
  const crossChapterDropTargetId: ChapterId | null =
    sceneDropTarget &&
    sceneDropTarget.chapterId !== sceneDragRef.current?.originChapterId
      ? sceneDropTarget.chapterId
      : null;

  return {
    sceneDropTarget,
    crossChapterDropTargetId,
    onDragStart,
    onDragOver,
    onDragEnd,
  };
}
