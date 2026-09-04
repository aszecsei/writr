/** Split on runs of whitespace, dropping empty pieces. */
export function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}
