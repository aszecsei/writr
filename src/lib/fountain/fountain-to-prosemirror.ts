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

/**
 * Parse basic Fountain inline formatting into ProseMirror text nodes with marks.
 *
 * Fountain supports:
 *   ***bold italic***  -> bold + italic
 *   **bold**           -> bold
 *   *italic*           -> italic
 *   _underline_        -> underline
 */
function parseInlineFormatting(text: string): ProseMirrorNodeJSON[] {
  if (!text) return [];

  const nodes: ProseMirrorNodeJSON[] = [];
  // Simple regex-based parser for inline formatting
  // Process in order: bold-italic, bold, italic, underline
  const regex = /(\*{3})(.*?)\1|(\*{2})(.*?)\3|(\*)(.*?)\5|(_)(.*?)\7/g;

  let lastIndex = 0;
  let match = regex.exec(text);

  while (match !== null) {
    // Add any plain text before this match
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[1] === "***") {
      // Bold italic
      nodes.push({
        type: "text",
        text: match[2],
        marks: [{ type: "bold" }, { type: "italic" }],
      });
    } else if (match[3] === "**") {
      // Bold
      nodes.push({
        type: "text",
        text: match[4],
        marks: [{ type: "bold" }],
      });
    } else if (match[5] === "*") {
      // Italic
      nodes.push({
        type: "text",
        text: match[6],
        marks: [{ type: "italic" }],
      });
    } else if (match[7] === "_") {
      // Underline
      nodes.push({
        type: "text",
        text: match[8],
        marks: [{ type: "underline" }],
      });
    }

    lastIndex = match.index + match[0].length;
    match = regex.exec(text);
  }

  // Add any remaining plain text
  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text }];
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
      content: parseInlineFormatting(el.text),
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
