export interface ParsedQuery {
  phrases: string[];
  tokens: string;
}

// Only double quotes act as phrase delimiters. Single quotes are kept literal
// so apostrophes in contractions ("Bob's", "don't") don't get parsed as
// phrase boundaries.
const QUOTE_RE = /"([^"]*)"/g;

export function parseQuery(raw: string): ParsedQuery {
  const phrases: string[] = [];
  let cleaned = raw.replace(QUOTE_RE, (_match, inner: string) => {
    const phrase = inner.trim();
    if (phrase) phrases.push(phrase);
    return " ";
  });
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return { phrases, tokens: cleaned };
}
