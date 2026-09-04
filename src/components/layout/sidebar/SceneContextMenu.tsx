"use client";

import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  SplitSquareVertical,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@/components/ui/ContextMenu";
import type { ChapterId, Scene } from "@/db/schemas";
import type { BinderNode } from "@/lib/binder/tree";

/** The scene right-click menu: reorder, promote, move to another chapter, delete. */
export function SceneContextMenu({
  scene,
  position,
  sceneTerm,
  promoteLabel,
  nodeIndex,
  onClose,
  onReorder,
  onPromote,
  onMoveTo,
  onDelete,
}: {
  scene: Scene;
  position: { x: number; y: number };
  sceneTerm: string;
  /** Label for the "Promote to X" item, e.g. "Chapter". */
  promoteLabel: string;
  nodeIndex: Map<ChapterId, BinderNode>;
  onClose: () => void;
  onReorder: (scene: Scene, direction: -1 | 1) => void;
  onPromote: (scene: Scene) => void;
  onMoveTo: (scene: Scene, targetChapterId: ChapterId) => void;
  onDelete: (scene: Scene) => void;
}) {
  const targets = [...nodeIndex.values()]
    .map((n) => n.chapter)
    .filter((c) => c.kind !== "separator" && c.id !== scene.chapterId);

  return (
    <ContextMenu position={position} onClose={onClose}>
      <ContextMenuItem icon={ArrowUp} onClick={() => onReorder(scene, -1)}>
        Move Up
      </ContextMenuItem>
      <ContextMenuItem icon={ArrowDown} onClick={() => onReorder(scene, 1)}>
        Move Down
      </ContextMenuItem>
      <ContextMenuItem
        icon={SplitSquareVertical}
        onClick={() => onPromote(scene)}
      >
        Promote to {promoteLabel}
      </ContextMenuItem>
      {targets.length > 0 && (
        <>
          <ContextMenuSeparator />
          <ContextMenuLabel>Move to</ContextMenuLabel>
          {targets.map((c) => (
            <ContextMenuItem
              key={c.id}
              icon={ArrowRightLeft}
              onClick={() => onMoveTo(scene, c.id)}
            >
              {c.title}
            </ContextMenuItem>
          ))}
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={Trash2}
        variant="danger"
        onClick={() => onDelete(scene)}
      >
        Delete {sceneTerm}
      </ContextMenuItem>
    </ContextMenu>
  );
}
