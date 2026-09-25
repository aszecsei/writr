import { parseFountainInline } from "./inline";
import type { FountainElement } from "./types";

interface ProseMirrorNodeJSON {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNodeJSON[];
  text?: string;
  marks?: { type: string }[];
}

/**
 * Maps FountainElementType to ProseMirror node type name.
 */
const NODE_TYPE_MAP: Record<string, string> = {
  scene_heading: "sceneHeading",
  action: "action",
  character: "character",
  dialogue: "dialogue",
  parenthetical: "parenthetical",
  transition: "transition",
  centered: "centered",
  page_break: "screenplayPageBreak",
};

function inlineContent(text: string): ProseMirrorNodeJSON[] {
  return parseFountainInline(text).map((span) =>
    span.marks.length === 0
      ? { type: "text", text: span.text }
      : {
          type: "text",
          text: span.text,
          marks: span.marks.map((type) => ({ type })),
        },
  );
}

/**
 * Convert FountainElement[] to a ProseMirror document JSON structure.
 */
export function fountainToProseMirror(
  elements: FountainElement[],
): ProseMirrorNodeJSON {
  const content: ProseMirrorNodeJSON[] = [];

  for (const el of elements) {
    const nodeType = NODE_TYPE_MAP[el.type];
    if (!nodeType) continue;

    if (el.type === "page_break") {
      content.push({ type: "screenplayPageBreak" });
      continue;
    }

    const node: ProseMirrorNodeJSON = {
      type: nodeType,
      content: inlineContent(el.text),
    };

    if (el.type === "scene_heading" && el.sceneNumber) {
      node.attrs = { sceneNumber: el.sceneNumber };
    }

    content.push(node);
  }

  // If empty, add a single empty action node
  if (content.length === 0) {
    content.push({
      type: "action",
      content: [{ type: "text", text: "" }],
    });
  }

  return { type: "doc", content };
}
