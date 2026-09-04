/**
 * FNV-1a 32-bit hash as zero-padded hex. Not cryptographic — used only for
 * cheap change detection (retrieval chunk text, TTS audio cache keys), so a
 * fast non-crypto hash is correct.
 */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
