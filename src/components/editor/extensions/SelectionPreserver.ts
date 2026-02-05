import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface SelectionPreserverOptions {
  onSelectionChange:
    | ((text: string, from: number, to: number) => void)
    | undefined;
  onSelectionClear: (() => void) | undefined;
}

const pluginKey = new PluginKey<DecorationSet>("selectionPreserver");

export const SelectionPreserver = Extension.create<SelectionPreserverOptions>({
  name: "selectionPreserver",

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
    let hasFocus = true;

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, old, _oldState, newState) {
            const blurRange = tr.getMeta(pluginKey) as
              | { from: number; to: number }
              | "clear"
              | undefined;

            if (blurRange === "clear") {
              return DecorationSet.empty;
            }

            if (
              blurRange &&
              typeof blurRange === "object" &&
              blurRange.from < blurRange.to
            ) {
              const deco = Decoration.inline(blurRange.from, blurRange.to, {
                class: "selection-preserved",
              });
              return DecorationSet.create(newState.doc, [deco]);
            }

            // Map existing decorations through doc changes
            if (tr.docChanged && old !== DecorationSet.empty) {
              return old.map(tr.mapping, tr.doc);
            }

            return old;
          },
        },
        props: {
          decorations(state) {
            return pluginKey.getState(state) ?? DecorationSet.empty;
          },
          handleDOMEvents: {
            blur(view) {
              hasFocus = false;
              const { from, to } = view.state.selection;
              if (from < to) {
                const tr = view.state.tr.setMeta(pluginKey, { from, to });
                view.dispatch(tr);
              }
              return false;
            },
            focus(view) {
              hasFocus = true;
              const current =
                pluginKey.getState(view.state) ?? DecorationSet.empty;
              if (current !== DecorationSet.empty) {
                const tr = view.state.tr.setMeta(pluginKey, "clear");
                view.dispatch(tr);
              }
              return false;
            },
          },
        },
        view() {
          return {
            update(view, prevState) {
              if (!hasFocus) return;

              const { from, to, empty } = view.state.selection;

              // Only fire if selection actually changed
              if (view.state.selection.eq(prevState.selection)) return;

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
