import { Node, type NodeViewRendererProps } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { sceneBreakMarker } from "@/lib/scenes/segments";

/**
 * tiptap-markdown's serializer state — the library ships no public type, so we
 * describe only the surface this serializer touches (mirrors MarkdownBlockquote).
 */
interface MarkdownState {
  write(content?: string): void;
  closeBlock(node: unknown): void;
}

export interface SceneBreakOptions {
  /**
   * Ref to a `sceneId → title` map. A ref (not a value) so the marker's label
   * can follow live title edits without reconfiguring the extension — a
   * SCENE_TITLES_UPDATED_META dispatch rebuilds the label decorations. Titles
   * live in Dexie (they are not a node attribute), so the editor reads them
   * through this ref. Defaulted to `undefined` to keep TipTap's option
   * deep-merge from clobbering the ref identity.
   */
  sceneTitlesRef: { current: Map<string, string> } | undefined;
}

const sceneBreakPluginKey = new PluginKey<DecorationSet>("sceneBreak");

/** Metadata key signalling that scene-break title labels should rebuild. */
export const SCENE_TITLES_UPDATED_META = "sceneTitlesUpdated";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sceneBreak: {
      /** Insert a scene-break marker carrying the given scene id. */
      insertSceneBreak: (sceneId: string) => ReturnType;
    };
  }
}

/**
 * Paint each scene-break marker with the title of the scene it begins, read
 * from the `sceneId → title` ref. A node decoration adds `data-scene-title` to
 * the marker's `<hr>`, which the `.scene-break` CSS surfaces as a bracketed
 * small-caps label. Untitled scenes get no attribute and fall back to the
 * generic label.
 */
function buildTitleDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  titles: Map<string, string>,
): DecorationSet {
  const decorations: Decoration[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name !== "sceneBreak") return;
    const sceneId = node.attrs.sceneId as string | null;
    const title = sceneId ? titles.get(sceneId)?.trim() : undefined;
    if (!title) return;
    decorations.push(
      Decoration.node(offset, offset + node.nodeSize, {
        "data-scene-title": title,
      }),
    );
  });
  if (decorations.length === 0) return DecorationSet.empty;
  return DecorationSet.create(doc, decorations);
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
export const SceneBreak = Node.create<SceneBreakOptions>({
  name: "sceneBreak",
  group: "block",
  atom: true,
  selectable: true,
  priority: 200,

  addOptions() {
    return {
      sceneTitlesRef: undefined as { current: Map<string, string> } | undefined,
    };
  },

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

  // The stored/serialized form is a plain `<hr>` (see renderHTML + the markdown
  // serializer), but in the editor the marker is drawn as `rule — [ label ] —
  // rule` so the brackets and hairline are real elements the CSS can bind to.
  // The label text is the scene title (or a positional fallback) read from the
  // `sceneId → label` ref; the decoration plugin below re-fires this view's
  // `update` whenever a label changes so the DOM stays in sync.
  addNodeView() {
    const { sceneTitlesRef } = this.options;
    return ({ node }: NodeViewRendererProps) => {
      const dom = document.createElement("div");
      dom.className = "scene-break";
      dom.setAttribute("data-type", "sceneBreak");
      dom.setAttribute("contenteditable", "false");

      const leftRule = document.createElement("span");
      leftRule.className = "scene-break-rule";
      const label = document.createElement("span");
      label.className = "scene-break-label";
      const rightRule = document.createElement("span");
      rightRule.className = "scene-break-rule";
      dom.append(leftRule, label, rightRule);

      const paint = (current: ProseMirrorNode) => {
        const sceneId = current.attrs.sceneId as string | null;
        label.textContent =
          (sceneId ? sceneTitlesRef?.current.get(sceneId) : "") ?? "";
      };
      paint(node);

      return {
        dom,
        update: (updated: ProseMirrorNode) => {
          if (updated.type.name !== "sceneBreak") return false;
          paint(updated);
          return true;
        },
        // Fully derived from Dexie state — never read content back out of it.
        ignoreMutation: () => true,
      };
    };
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
          state.write(sceneBreakMarker(id));
          state.closeBlock(node);
        },
        parse: {
          // handled by markdown-it's html_block passthrough + parseHTML above
        },
      },
    };
  },

  addProseMirrorPlugins() {
    const { sceneTitlesRef } = this.options;
    return [
      new Plugin<DecorationSet>({
        key: sceneBreakPluginKey,
        state: {
          init(_config, instance): DecorationSet {
            return buildTitleDecorations(
              instance.doc,
              sceneTitlesRef?.current ?? new Map(),
            );
          },
          apply(tr, old, _oldState, newState): DecorationSet {
            if (tr.getMeta(SCENE_TITLES_UPDATED_META) || tr.docChanged) {
              return buildTitleDecorations(
                newState.doc,
                sceneTitlesRef?.current ?? new Map(),
              );
            }
            return old;
          },
        },
        props: {
          decorations(state) {
            return sceneBreakPluginKey.getState(state) ?? null;
          },
        },
      }),
    ];
  },
});
