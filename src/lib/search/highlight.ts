const SNIPPET_CONTEXT_CHARS = 50;
const MAX_SNIPPET_LENGTH = 120;

export function extractSnippet(text: string, query: string): string {
  if (!text || !query) return "";

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return (
      text.slice(0, MAX_SNIPPET_LENGTH) +
      (text.length > MAX_SNIPPET_LENGTH ? "..." : "")
    );
  }

  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(
    text.length,
    matchIndex + query.length + SNIPPET_CONTEXT_CHARS,
  );

  let snippet = text.slice(start, end);

  if (start > 0) {
    snippet = `...${snippet}`;
  }
  if (end < text.length) {
    snippet = `${snippet}...`;
  }

  return snippet;
}

export interface HighlightPart {
  text: string;
  isMatch: boolean;
}

export function splitByMatch(text: string, query: string): HighlightPart[] {
  if (!text) return [];
  if (!query) return [{ text, isMatch: false }];

  const parts: HighlightPart[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;

  let matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
  while (matchIndex !== -1) {
    if (matchIndex > lastIndex) {
      parts.push({ text: text.slice(lastIndex, matchIndex), isMatch: false });
    }
    parts.push({
      text: text.slice(matchIndex, matchIndex + query.length),
      isMatch: true,
    });
    lastIndex = matchIndex + query.length;
    matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isMatch: false });
  }

  return parts;
}
