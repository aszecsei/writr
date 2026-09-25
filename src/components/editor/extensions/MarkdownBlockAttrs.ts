import { getHTMLFromFragment } from "@tiptap/core";
import Heading from "@tiptap/extension-heading";
import Paragraph from "@tiptap/extension-paragraph";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  defaultMarkdownSerializer,
  type MarkdownSerializerState,
} from "prosemirror-markdown";

/**
 * Markdown has no syntax for alignment or indentation, so tiptap-markdown's
 * default paragraph/heading serializers silently drop the `textAlign`
 * (TextAlign) and `indent` (Indent) attributes. A block carrying either is
 * written as an HTML block instead; markdown-it passes it through (the
 * Markdown extension runs with `html: true`) and each extension's `parseHTML`
 * restores the attribute. The export pipeline reads the same form — see
 * `parseHtmlAlignmentAndIndent` in `src/lib/export/markdown-to-nodes.ts`.
 */
function hasBlockAttrs(node: ProseMirrorNode): boolean {
  const { textAlign, indent } = node.attrs;
  return (textAlign != null && textAlign !== "left") || indent > 0;
}

/**
 * Mirrors tiptap-markdown's own HTML-node serializer: a top-level block puts
 * its content on separate lines so it reads as a CommonMark HTML block; a
 * nested one (inside a list item or blockquote) is written inline.
 */
function serializeAsHtml(
  state: MarkdownSerializerState,
  node: ProseMirrorNode,
  parent: ProseMirrorNode | Fragment,
) {
  const schema = node.type.schema;
  const html = getHTMLFromFragment(Fragment.from(node), schema);
  const isTopLevel =
    parent instanceof Fragment || parent.type === schema.topNodeType;
  if (isTopLevel) {
    const element = new DOMParser().parseFromString(html, "text/html").body
      .firstElementChild;
    if (element) {
      element.innerHTML = element.innerHTML.trim()
        ? `\n${element.innerHTML}\n`
        : "\n";
      state.write(element.outerHTML);
    }
  } else {
    state.write(html);
  }
  state.closeBlock(node);
}

export const MarkdownParagraph = Paragraph.extend({
  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        serialize(
          state: MarkdownSerializerState,
          node: ProseMirrorNode,
          parent: ProseMirrorNode,
          index: number,
        ) {
          if (hasBlockAttrs(node)) serializeAsHtml(state, node, parent);
          else
            defaultMarkdownSerializer.nodes.paragraph(
              state,
              node,
              parent,
              index,
            );
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});

export const MarkdownHeading = Heading.extend({
  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        serialize(
          state: MarkdownSerializerState,
          node: ProseMirrorNode,
          parent: ProseMirrorNode,
          index: number,
        ) {
          if (hasBlockAttrs(node)) serializeAsHtml(state, node, parent);
          else
            defaultMarkdownSerializer.nodes.heading(state, node, parent, index);
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});
