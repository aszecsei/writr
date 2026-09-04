const EXCERPT_MAX_LENGTH = 80;

export function makeExcerpt(text: string): string {
  if (text.length <= EXCERPT_MAX_LENGTH) return text;
  return `${text.slice(0, EXCERPT_MAX_LENGTH - 1).trimEnd()}…`;
}
