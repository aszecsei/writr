import type { EditorView } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";

/** The editor's scrollable ancestor (the chrome around `ChapterEditor` marks it `.overflow-y-auto`). */
export function getScrollContainer(view: EditorView): HTMLElement | null {
  return view.dom.closest(".overflow-y-auto");
}

interface ScrollToPosOptions {
  /** Center `pos` in the scroll container instead of scrolling it to the top edge. */
  center?: boolean;
}

/** Smooth-scroll the editor's scroll container so `pos` is visible. */
export function scrollToPos(
  editor: Editor,
  pos: number,
  options: ScrollToPosOptions = {},
): void {
  const view = editor.view;
  const scrollContainer = getScrollContainer(view);
  if (!scrollContainer) return;

  const coords = view.coordsAtPos(pos);
  const containerRect = scrollContainer.getBoundingClientRect();
  const offset = coords.top - containerRect.top + scrollContainer.scrollTop;
  const scrollTop = options.center ? offset - containerRect.height / 2 : offset;

  scrollContainer.scrollTo({ top: scrollTop, behavior: "smooth" });
}
