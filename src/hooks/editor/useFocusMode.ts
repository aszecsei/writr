import type { Editor } from "@tiptap/react";
import type { RefObject } from "react";
import { useEffect } from "react";

/**
 * Manages focus mode behavior: focuses the editor and scrolls to center
 * the cursor when entering focus mode or fullscreen.
 */
export function useFocusMode(
  focusModeEnabled: boolean,
  editor: Editor | null,
  scrollContainerRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!focusModeEnabled || !editor || editor.isDestroyed) return;

    const focusAndScroll = () => {
      if (editor.isDestroyed || !scrollContainerRef.current) return;

      editor.commands.focus();

      const view = editor.view;
      const { from } = view.state.selection;
      const coords = view.coordsAtPos(from);
      const container = scrollContainerRef.current;

      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.height / 2;
      const cursorOffsetInContainer =
        coords.top - containerRect.top + container.scrollTop;
      const targetScroll = cursorOffsetInContainer - containerCenter;

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: "instant",
      });
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        setTimeout(focusAndScroll, 50);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    const timeoutId = setTimeout(focusAndScroll, 100);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      clearTimeout(timeoutId);
    };
  }, [focusModeEnabled, editor, scrollContainerRef]);
}
