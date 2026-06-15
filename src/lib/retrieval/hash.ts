/**
 * FNV-1a 32-bit hash as zero-padded hex. Used only for change detection on
 * chunk text — not security-sensitive — so a fast non-crypto hash is correct.
 */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
