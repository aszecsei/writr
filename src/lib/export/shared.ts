/** Scene-break / horizontal rule text used in DOCX and PDF exports. */
export const HR_TEXT = "*\u2003\u2003*\u2003\u2003*";

/** Placeholder text for images that can't be embedded in the export format. */
export function imagePlaceholder(alt?: string): string {
  return alt ? `[Image: ${alt}]` : "[Image]";
}
