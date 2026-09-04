"use client";

import { useDraggable, useDroppable } from "@dnd-kit/react";
import Link from "next/link";
import { useCallback } from "react";
import { DragHandle } from "@/components/bible/DragHandle";
import type { ProjectId, Scene } from "@/db/schemas";
import { useEditorStore } from "@/store/editorStore";
import { INDENT_PX } from "./BinderItem";

/** A 2px accent bar marking where a dragged scene will be inserted. */
export function SceneDropLine({ indent }: { indent: number }) {
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
 * it to reorder within its chapter or into another chapter.
 */
export function SceneRow({
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
