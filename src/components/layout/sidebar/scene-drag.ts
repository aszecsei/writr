import type { SceneId } from "@/db/schemas";

/**
 * Compute the new core-first scene order after dragging `movedId` to sit
 * immediately before `beforeId` (or to the end of the chapter when `beforeId`
 * is null). Pure so the sidebar's drag commit is unit-testable without dnd-kit.
 *
 * Returns null when the move is a no-op (resulting order is unchanged) or
 * invalid (moved/target id not in the current order) — callers skip the write.
 */
export function planSceneReorder(
  currentOrder: SceneId[],
  movedId: SceneId,
  beforeId: SceneId | null,
): SceneId[] | null {
  if (beforeId === movedId) return null;
  if (!currentOrder.includes(movedId)) return null;
  const without = currentOrder.filter((id) => id !== movedId);
  const insertAt =
    beforeId === null ? without.length : without.indexOf(beforeId);
  if (insertAt < 0) return null; // stale beforeId — leave the order untouched
  const next = [
    ...without.slice(0, insertAt),
    movedId,
    ...without.slice(insertAt),
  ];
  const unchanged =
    next.length === currentOrder.length &&
    next.every((id, i) => id === currentOrder[i]);
  return unchanged ? null : next;
}
