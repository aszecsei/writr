import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  buildHoleRegex,
  DEFAULT_HOLE_DELIMITERS,
  type HoleDelimiters,
} from "@/lib/holes";

export interface HolesOptions {
  /**
   * Ref to the configured delimiters. A ref (not a value) so the extension can
   * read the latest delimiters without being reconfigured — a HOLES_UPDATED_META
   * dispatch rebuilds decorations when the user changes the setting. Defaulted to
   * `undefined` to avoid TipTap's deep-merge clobbering the ref identity.
   */
  delimitersRef: { current: HoleDelimiters } | undefined;
}

const holesPluginKey = new PluginKey<HolesPluginState>("holes");

/** Metadata key used to signal that hole decorations should rebuild. */
export const HOLES_UPDATED_META = "holesUpdated";

interface HolesPluginState {
  decorations: DecorationSet;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    holes: {
      /**
       * Wrap the current selection in the hole delimiters, or insert an empty
       * pair with the cursor between them when the selection is empty.
       */
      insertHole: () => ReturnType;
    };
  }
}

/** Scan text nodes for holes and build inline highlight decorations. */
function buildHoleDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  delimiters: HoleDelimiters,
): DecorationSet {
  const regex = buildHoleRegex(delimiters);
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    regex.lastIndex = 0;
    let match = regex.exec(text);
    while (match !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      decorations.push(
        Decoration.inline(from, to, { class: "hole-highlight" }),
      );
      if (match[0].length === 0) regex.lastIndex = match.index + 1;
      match = regex.exec(text);
    }
  });

  if (decorations.length === 0) return DecorationSet.empty;
  return DecorationSet.create(doc, decorations);
}

/**
 * Highlights "holes" — bracketed placeholder sections the author intends to
 * fill later (see `src/lib/holes.ts`). Holes are plain text, not a node or
 * mark, so this extension only paints decorations and offers an insert command;
 * the stored content stays plain markdown.
 */
export const Holes = Extension.create<HolesOptions>({
  name: "holes",

  addOptions() {
    return {
      delimitersRef: undefined as { current: HoleDelimiters } | undefined,
    };
  },

  addCommands() {
    return {
      insertHole:
        () =>
        ({ state, dispatch }) => {
          const { open, close } =
            this.options.delimitersRef?.current ?? DEFAULT_HOLE_DELIMITERS;
          const { from, to, empty } = state.selection;

          if (dispatch) {
            if (empty) {
              const tr = state.tr.insertText(open + close, from);
              const caret = from + open.length;
              tr.setSelection(TextSelection.create(tr.doc, caret));
              dispatch(tr.scrollIntoView());
            } else {
              const selected = state.doc.textBetween(from, to, "\n");
              const tr = state.tr.insertText(open + selected + close, from, to);
              dispatch(tr.scrollIntoView());
            }
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-h": () => this.editor.commands.insertHole(),
    };
  },

  addProseMirrorPlugins() {
    const { delimitersRef } = this.options;

    return [
      new Plugin({
        key: holesPluginKey,
        state: {
          init(_config, instance): HolesPluginState {
            const delimiters =
              delimitersRef?.current ?? DEFAULT_HOLE_DELIMITERS;
            return {
              decorations: buildHoleDecorations(instance.doc, delimiters),
            };
          },
          apply(tr, old, _oldState, newState): HolesPluginState {
            if (tr.getMeta(HOLES_UPDATED_META) || tr.docChanged) {
              const delimiters =
                delimitersRef?.current ?? DEFAULT_HOLE_DELIMITERS;
              return {
                decorations: buildHoleDecorations(newState.doc, delimiters),
              };
            }
            return old;
          },
        },
        props: {
          decorations(state) {
            return holesPluginKey.getState(state)?.decorations ?? null;
          },
        },
      }),
    ];
  },
});
