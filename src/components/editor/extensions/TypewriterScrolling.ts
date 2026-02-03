import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface TypewriterScrollingOptions {
  enabledRef: { current: boolean };
}

export const TypewriterScrolling = Extension.create<TypewriterScrollingOptions>(
  {
    name: "typewriterScrolling",

    addOptions() {
      return {
        enabledRef: { current: false },
      };
    },

    addProseMirrorPlugins() {
      const { enabledRef } = this.options;

      return [
        new Plugin({
          key: new PluginKey("typewriterScrolling"),
          view() {
            return {
              update(view, prevState) {
                // Check if enabled via ref (allows dynamic toggling)
                if (!enabledRef.current) return;

                // Only scroll if selection changed
                if (prevState && view.state.selection.eq(prevState.selection)) {
                  return;
                }

                const { from } = view.state.selection;
                const coords = view.coordsAtPos(from);

                // Find the scrollable container (the editor's parent with overflow-y-auto)
                const editorElement = view.dom;
                const scrollContainer = editorElement.closest(
                  ".overflow-y-auto",
                ) as HTMLElement | null;

                if (!scrollContainer) return;

                const containerRect = scrollContainer.getBoundingClientRect();
                const containerCenter =
                  containerRect.top + containerRect.height / 2;

                // Calculate how much to scroll to center the cursor
                const scrollOffset = coords.top - containerCenter;

                // Use instant scrolling to prevent jitter during typing
                // Small threshold to avoid micro-adjustments
                if (Math.abs(scrollOffset) > 2) {
                  scrollContainer.scrollBy({
                    top: scrollOffset,
                    behavior: "instant",
                  });
                }
              },
            };
          },
        }),
      ];
    },
  },
);
