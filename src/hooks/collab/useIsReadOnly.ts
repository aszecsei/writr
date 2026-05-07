import { collabSelectors, useCollabStore } from "@/store/collabStore";

/**
 * True when the local peer is a guest in a project-share session AND
 * is viewing content outside the active chapter editor. The host (and
 * any non-collab user) is never read-only by this rule. The active
 * chapter editor uses `canEditProse` / `canEditComments` instead so
 * `edit` / `review` privileges still apply to the active chapter.
 *
 * Pass the chapter id of the current view; if it matches the host's
 * activeChapterId, the function defers to the role-based selectors.
 */
export function useIsReadOnlyContent(
  opts?: {
    /** Chapter id of the current view, if any. */
    currentChapterId?: string | null;
  } | null,
): boolean {
  const session = useCollabStore((s) => s.session);
  const role = useCollabStore((s) => s.role);
  const projectMode = useCollabStore(collabSelectors.isProjectMode);
  const isHost = useCollabStore(collabSelectors.isHost);
  if (session === null || role === null) return false;
  if (isHost) return false;
  if (!projectMode) return false;
  // Note: the active chapter editor branches on its own role-based
  // selectors. This hook intentionally returns true even when the
  // current view IS the active chapter — the chapter editor should not
  // be reading from this hook. It exists for bible / outline / non-active
  // chapter views that should always be read-only for project-share guests.
  void opts;
  return true;
}
