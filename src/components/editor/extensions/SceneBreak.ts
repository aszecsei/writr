import { Node } from "@tiptap/core";

/**
 * tiptap-markdown's serializer state — the library ships no public type, so we
 * describe only the surface this serializer touches (mirrors MarkdownBlockquote).
 */
interface MarkdownState {
  write(content?: string): void;
  closeBlock(node: unknown): void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sceneBreak: {
      /** Insert a scene-break marker carrying the given scene id. */
      insertSceneBreak: (sceneId: string) => ReturnType;
    };
  }
}

/**
 * A Model-D scene boundary: an atom block node dividing a chapter's single
 * document into scenes. It carries the `sceneId` of the scene that *begins*
 * after it (the content before the first marker is the implicit core scene, so
 * it has no marker). Rendered as a centered small-caps "SCENE" rule via the
 * `.scene-break` CSS.
 *
 * Round-trip: serialized to `<hr data-type="sceneBreak" data-scene-id="…">`.
 * With `Markdown.configure({ html: true })` markdown-it passes this HTML block
 * through verbatim, and TipTap's HTML parser reconstructs the node via the
 * `parseHTML` rule below — no custom markdown-it plugin needed. A higher
 * `priority` than StarterKit's HorizontalRule (default 100) ensures the
 * specific `hr[data-type="sceneBreak"]` rule is matched before the generic
 * `hr` rule for a plain thematic break.
 */
export const SceneBreak = Node.create({
  name: "sceneBreak",
  group: "block",
  atom: true,
  selectable: true,
  priority: 200,

  addAttributes() {
    return {
      sceneId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-scene-id"),
        renderHTML: (attributes) =>
          attributes.sceneId
            ? { "data-scene-id": attributes.sceneId as string }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'hr[data-type="sceneBreak"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "hr",
      { ...HTMLAttributes, "data-type": "sceneBreak", class: "scene-break" },
    ];
  },

  addCommands() {
    return {
      insertSceneBreak:
        (sceneId: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { sceneId },
          }),
    };
  },

  addKeyboardShortcuts() {
    return {
      // Insert a scene break at the cursor. The marker carries a fresh id; the
      // editor's save-path reconcile creates the backing Scene row.
      "Mod-Shift-Enter": () =>
        this.editor.commands.insertSceneBreak(crypto.randomUUID()),
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownState, node: { attrs: { sceneId?: string } }) {
          const id = node.attrs.sceneId ?? "";
          state.write(`<hr data-type="sceneBreak" data-scene-id="${id}">`);
          state.closeBlock(node);
        },
        parse: {
          // handled by markdown-it's html_block passthrough + parseHTML above
        },
      },
    };
  },
});
