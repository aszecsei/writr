import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface SelectionReporterOptions {
  onSelectionChange:
    | ((text: string, from: number, to: number) => void)
    | undefined;
  onSelectionClear: (() => void) | undefined;
}

const pluginKey = new PluginKey("selectionReporter");

/**
 * Reports the editor's current selection to the host app via callbacks so
 * UI outside the editor (e.g. the AI panel) can act on the selected text.
 * The visual blur-highlight is handled separately by the builtin `Selection`
 * extension from `@tiptap/extensions`.
 *
 * Fires only while the editor has focus: when focus leaves the editor (e.g.
 * the user clicks into the AI panel) we must NOT clear the stored selection,
 * which is the whole point of preserving it.
 */
export const SelectionReporter = Extension.create<SelectionReporterOptions>({
  name: "selectionReporter",

  addOptions() {
    return {
      onSelectionChange: undefined as
        | ((text: string, from: number, to: number) => void)
        | undefined,
      onSelectionClear: undefined as (() => void) | undefined,
    };
  },

  addProseMirrorPlugins() {
    const { onSelectionChange, onSelectionClear } = this.options;

    return [
      new Plugin({
        key: pluginKey,
        view() {
          return {
            update(view, prevState) {
              if (!view.hasFocus()) return;
              if (view.state.selection.eq(prevState.selection)) return;

              const { from, to, empty } = view.state.selection;
              if (empty) {
                onSelectionClear?.();
              } else {
                const text = view.state.doc.textBetween(from, to, "\n");
                onSelectionChange?.(text, from, to);
              }
            },
          };
        },
      }),
    ];
  },
});
