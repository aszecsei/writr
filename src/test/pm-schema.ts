import { type Node, Schema } from "@tiptap/pm/model";

/**
 * Minimal ProseMirror schema shared by tests that walk a doc directly
 * (no editor instance): paragraphs, headings, code blocks, hard breaks,
 * and the marks needed to test mark-aware traversal.
 */
export const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    heading: { content: "inline*", group: "block" },
    codeBlock: {
      content: "text*",
      group: "block",
      code: true,
      parseDOM: [{ tag: "pre" }],
    },
    text: { group: "inline" },
    hardBreak: {
      group: "inline",
      inline: true,
      selectable: false,
      parseDOM: [{ tag: "br" }],
    },
  },
  marks: {
    code: { parseDOM: [{ tag: "code" }] },
    em: { parseDOM: [{ tag: "em" }] },
    strong: { parseDOM: [{ tag: "strong" }] },
  },
});

export function doc(...content: Node[]): Node {
  return schema.node("doc", null, content);
}

export function p(...content: Node[]): Node {
  return schema.node("paragraph", null, content);
}

export function heading(...content: Node[]): Node {
  return schema.node("heading", null, content);
}

export function codeBlock(...content: Node[]): Node {
  return schema.node("codeBlock", null, content);
}

export function text(value: string, marks?: string[]): Node {
  return schema.text(
    value,
    marks?.map((name) => schema.mark(name)),
  );
}

export function hardBreak(): Node {
  return schema.node("hardBreak");
}
