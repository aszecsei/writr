/**
 * Escape a string for safe interpolation into an XML/HTML-style attribute
 * value (the `<chapter id="…">`, `<selected-text chapter-id="…">` blocks the
 * model parses). Escapes `&` first so the `"` replacement can't double-encode,
 * then `"` to keep the attribute from being terminated early.
 *
 * Shared by every wire-format conversion site (`prompts.ts`,
 * `toAiMessages.ts`) so the two agree on exactly one encoding.
 */
export function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Escape a string for safe interpolation into an XML/HTML-style element body
 * (the text between `<flag>…</flag>` etc.). Escapes `&` first so the angle
 * brackets can't double-encode, then `<`/`>` so user content can't open or
 * close tags — preventing a crafted `</guardrail>` from terminating the block
 * early and letting following text be read as top-level instructions.
 */
export function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
