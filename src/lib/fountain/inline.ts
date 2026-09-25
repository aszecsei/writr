export type FountainMark = "bold" | "italic" | "underline";

export interface FountainSpan {
  text: string;
  marks: FountainMark[];
}

/** Outermost first: `_**text**_`, `***text***`. */
const MARK_ORDER: FountainMark[] = ["underline", "bold", "italic"];

const DELIMITER: Record<FountainMark, string> = {
  underline: "_",
  bold: "**",
  italic: "*",
};

const STAR_MARKS: Record<number, FountainMark[]> = {
  1: ["italic"],
  2: ["bold"],
  3: ["bold", "italic"],
};

type Item =
  | { kind: "text"; text: string }
  | { kind: "delimiter"; marks: FountainMark[]; literal: string };

function sortMarks(marks: Iterable<FountainMark>): FountainMark[] {
  const set = new Set(marks);
  return MARK_ORDER.filter((m) => set.has(m));
}

function lex(text: string): Item[] {
  const items: Item[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) items.push({ kind: "text", text: buffer });
    buffer = "";
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" && "*_\\".includes(text[i + 1] ?? "")) {
      buffer += text[i + 1];
      i += 2;
    } else if (ch === "_") {
      flush();
      items.push({ kind: "delimiter", marks: ["underline"], literal: "" });
      i += 1;
    } else if (ch === "*") {
      let run = 1;
      while (text[i + run] === "*") run++;
      if (run > 3) {
        buffer += "*".repeat(run);
      } else {
        flush();
        items.push({ kind: "delimiter", marks: STAR_MARKS[run], literal: "" });
      }
      i += run;
    } else {
      buffer += ch;
      i += 1;
    }
  }
  flush();
  return items;
}

/**
 * Parse Fountain emphasis (`*italic*`, `**bold**`, `***both***`,
 * `_underline_`, and nestings like `_**both**_`) into styled spans.
 *
 * Each delimiter toggles its marks, so `**a*b***` is bold "a" then
 * bold-italic "b". A delimiter that never closes stays literal text, and
 * `\*`, `\_` and `\\` are literal characters.
 */
export function parseFountainInline(text: string): FountainSpan[] {
  const items = lex(text);

  // The last toggle of a mark that is still open at the end has no closer.
  const unclosed = new Map<FountainMark, number>();
  items.forEach((item, index) => {
    if (item.kind !== "delimiter") return;
    for (const mark of item.marks) {
      if (unclosed.has(mark)) unclosed.delete(mark);
      else unclosed.set(mark, index);
    }
  });
  for (const [mark, index] of unclosed) {
    const item = items[index] as Extract<Item, { kind: "delimiter" }>;
    item.marks = item.marks.filter((m) => m !== mark);
    item.literal += DELIMITER[mark];
  }

  const spans: FountainSpan[] = [];
  const push = (text: string, marks: FountainMark[]) => {
    if (!text) return;
    const last = spans.at(-1);
    if (last && last.marks.join() === marks.join()) last.text += text;
    else spans.push({ text, marks });
  };

  let active = new Set<FountainMark>();
  for (const item of items) {
    if (item.kind === "text") {
      push(item.text, sortMarks(active));
      continue;
    }
    push(item.literal, sortMarks(active));
    active = new Set(active);
    for (const mark of item.marks) {
      if (active.has(mark)) active.delete(mark);
      else active.add(mark);
    }
  }
  return spans;
}

function escapeText(text: string): string {
  return text.replace(/[\\*_]/g, "\\$&");
}

function intersect(a: FountainMark[], b: FountainMark[]): FountainMark[] {
  return a.filter((m) => b.includes(m));
}

/**
 * Fountain only reads emphasis whose delimiters touch non-space text, so
 * edge whitespace keeps only the marks it shares with its neighbour.
 */
function moveEdgeWhitespaceOutside(spans: FountainSpan[]): FountainSpan[] {
  const out: FountainSpan[] = [];
  spans.forEach((span, index) => {
    const match = span.text.match(/^(\s*)([\s\S]*?)(\s*)$/) ?? ["", "", "", ""];
    const [, leading, core, trailing] = match;
    const prev = spans[index - 1]?.marks ?? [];
    const next = spans[index + 1]?.marks ?? [];
    if (!core) {
      out.push({ text: span.text, marks: intersect(prev, span.marks) });
      return;
    }
    if (leading)
      out.push({ text: leading, marks: intersect(prev, span.marks) });
    out.push({ text: core, marks: span.marks });
    if (trailing)
      out.push({ text: trailing, marks: intersect(span.marks, next) });
  });
  return out;
}

/** Inverse of {@link parseFountainInline}. */
export function serializeFountainInline(spans: FountainSpan[]): string {
  let out = "";
  let active: FountainMark[] = [];
  const transition = (next: FountainMark[]) => {
    const closing = MARK_ORDER.filter(
      (m) => active.includes(m) && !next.includes(m),
    ).reverse();
    const opening = MARK_ORDER.filter(
      (m) => !active.includes(m) && next.includes(m),
    );
    out += [...closing, ...opening].map((m) => DELIMITER[m]).join("");
    active = next;
  };

  for (const span of moveEdgeWhitespaceOutside(spans.filter((s) => s.text))) {
    transition(span.marks);
    out += escapeText(span.text);
  }
  transition([]);
  return out;
}
