import type { EditorView } from "@tiptap/pm/view";
import type { Comment } from "@/db/schemas";

/**
 * Calculate the vertical position of a comment relative to its scroll container.
 * Returns null if the position cannot be determined.
 */
export function calculateCommentTop(
  view: EditorView,
  comment: Comment,
  positionMap: Map<string, { from: number; to: number }>,
): number | null {
  const scrollContainer = view.dom.closest(
    ".overflow-y-auto",
  ) as HTMLElement | null;
  if (!scrollContainer) return null;

  const docSize = view.state.doc.content.size;
  const mapped = positionMap.get(comment.id);
  const pos = Math.max(
    1,
    Math.min(mapped?.from ?? comment.fromOffset, docSize),
  );

  try {
    const coords = view.coordsAtPos(pos);
    const containerRect = scrollContainer.getBoundingClientRect();
    return coords.top - containerRect.top + scrollContainer.scrollTop;
  } catch {
    return null;
  }
}
