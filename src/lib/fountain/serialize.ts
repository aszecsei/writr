import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { match } from "ts-pattern";

/**
 * Serialize a ProseMirror document (with screenplay node types) back to Fountain plain text.
 */
export function serializeFountain(doc: ProseMirrorNode): string {
  const lines: string[] = [];

  doc.forEach((node, _offset, index) => {
    const text = node.textContent;

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
        lines.push(text.toUpperCase());
      })
      .with("dialogue", () => {
        // Dialogue follows character directly (no blank line)
        lines.push(text);
      })
      .with("parenthetical", () => {
        // Parenthetical follows character/dialogue directly
        const wrapped = text.startsWith("(") ? text : `(${text})`;
        lines.push(wrapped);
      })
      .with("transition", () => {
        if (index > 0) lines.push("");
        lines.push(text.toUpperCase());
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
