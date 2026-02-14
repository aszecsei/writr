import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * Serialize a ProseMirror document (with screenplay node types) back to Fountain plain text.
 */
export function serializeFountain(doc: ProseMirrorNode): string {
  const lines: string[] = [];

  doc.forEach((node, _offset, index) => {
    const text = node.textContent;

    switch (node.type.name) {
      case "sceneHeading": {
        // Blank line before scene heading (unless first element)
        if (index > 0) lines.push("");
        const sceneNumber = node.attrs.sceneNumber as string | undefined;
        if (sceneNumber) {
          lines.push(`${text} #${sceneNumber}#`);
        } else {
          lines.push(text);
        }
        break;
      }

      case "action": {
        // Blank line before action (unless first element)
        if (index > 0) lines.push("");
        lines.push(text);
        break;
      }

      case "character": {
        // Blank line before character name
        if (index > 0) lines.push("");
        lines.push(text.toUpperCase());
        break;
      }

      case "dialogue": {
        // Dialogue follows character directly (no blank line)
        lines.push(text);
        break;
      }

      case "parenthetical": {
        // Parenthetical follows character/dialogue directly
        const wrapped = text.startsWith("(") ? text : `(${text})`;
        lines.push(wrapped);
        break;
      }

      case "transition": {
        if (index > 0) lines.push("");
        lines.push(text.toUpperCase());
        break;
      }

      case "centered": {
        if (index > 0) lines.push("");
        lines.push(`> ${text} <`);
        break;
      }

      case "screenplayPageBreak": {
        if (index > 0) lines.push("");
        lines.push("===");
        break;
      }

      default: {
        // Fallback: treat as action
        if (index > 0) lines.push("");
        lines.push(text);
        break;
      }
    }
  });

  return lines.join("\n");
}
