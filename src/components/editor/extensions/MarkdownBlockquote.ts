import Blockquote from "@tiptap/extension-blockquote";

/**
 * tiptap-markdown's `MarkdownSerializerState` (a subclass of
 * prosemirror-markdown's). The library ships no public type for it, so we
 * describe only the surface this serializer touches.
 */
interface MarkdownState {
  constructor: new (
    nodes: unknown,
    marks: unknown,
    options: unknown,
  ) => MarkdownState;
  nodes: unknown;
  marks: unknown;
  options: unknown;
  out: string;
  renderContent(node: unknown): void;
  text(text: string, shouldEscape?: boolean): void;
  closeBlock(node: unknown): void;
}

/**
 * Blockquote with a corrected Markdown serializer.
 *
 * tiptap-markdown post-processes emphasis (`*`/`**`) with `trimInline`, which
 * does raw-string surgery on the accumulated output to satisfy CommonMark
 * left/right-flanking rules. The default blockquote serializer renders inner
 * content while the `> ` line prefixes are already in the output, so the blank
 * `>` separator between blockquote paragraphs gets misread as inline context
 * and the next paragraph's emphasis delimiter is shifted into the prefix —
 * producing `*> ...` that round-trips into literal text.
 *
 * Fix: serialize the children in a fresh sub-state (clean inline context, no
 * `> ` prefix present during trimming), then add the `> ` prefixes afterward.
 * Emitting the prefixed string via `state.text(..., false)` lets any outer
 * block delimiter (e.g. a list item's indent) stack onto continuation lines.
 */
export const MarkdownBlockquote = Blockquote.extend({
  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        serialize(state: MarkdownState, node: unknown) {
          const sub = new state.constructor(
            state.nodes,
            state.marks,
            state.options,
          );
          sub.renderContent(node);
          const inner = sub.out.replace(/\n+$/, "");
          const prefixed = inner
            .split("\n")
            .map((line) => (line.length ? `> ${line}` : ">"))
            .join("\n");
          state.text(prefixed, false);
          state.closeBlock(node);
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});
