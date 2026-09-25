import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { match } from "ts-pattern";
import {
  type FountainMark,
  type FountainSpan,
  serializeFountainInline,
} from "./inline";

const FOUNTAIN_MARKS = new Set<string>(["bold", "italic", "underline"]);

/** A block's inline content as Fountain text, keeping bold/italic/underline. */
function inlineFountain(node: ProseMirrorNode, upper = false): string {
  const spans: FountainSpan[] = [];
  node.forEach((child) => {
    if (!child.isText || !child.text) return;
    spans.push({
      text: upper ? child.text.toUpperCase() : child.text,
      marks: child.marks
        .map((m) => m.type.name)
        .filter((name): name is FountainMark => FOUNTAIN_MARKS.has(name)),
    });
  });
  return serializeFountainInline(spans);
}

/**
 * Serialize a ProseMirror document (with screenplay node types) back to Fountain plain text.
 */
export function serializeFountain(doc: ProseMirrorNode): string {
  const lines: string[] = [];

  doc.forEach((node, _offset, index) => {
    const text = inlineFountain(node);

    match(node.type.name)
      .with("sceneHeading", () => {
        if (index > 0) lines.push("");
        const sceneNumber = node.attrs.sceneNumber as string | undefined;
        if (sceneNumber) {
          lines.push(`${text} #${sceneNumber}#`);
        } else {
          lines.push(text);
        }
      })
      .with("action", () => {
        if (index > 0) lines.push("");
        lines.push(text);
      })
      .with("character", () => {
        if (index > 0) lines.push("");
        lines.push(inlineFountain(node, true));
      })
      .with("dialogue", () => {
        // Dialogue follows character directly (no blank line)
        lines.push(text);
      })
      .with("parenthetical", () => {
        // Parenthetical follows character/dialogue directly
        const wrapped = node.textContent.startsWith("(") ? text : `(${text})`;
        lines.push(wrapped);
      })
      .with("transition", () => {
        if (index > 0) lines.push("");
        lines.push(inlineFountain(node, true));
      })
      .with("centered", () => {
        if (index > 0) lines.push("");
        lines.push(`> ${text} <`);
      })
      .with("screenplayPageBreak", () => {
        if (index > 0) lines.push("");
        lines.push("===");
      })
      .otherwise(() => {
        // Fallback: treat as action
        if (index > 0) lines.push("");
        lines.push(text);
      });
  });

  return lines.join("\n");
}
