import type {
  Ast,
  ColumnRefNode,
  Constraint,
  Node,
  OptionalNode,
} from "./brainstorm-ast";

/** Remove one level of backslash escapes (`\x` → `x`). */
function unescapeText(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\\" && i + 1 < text.length) {
      result += text[i + 1];
      i += 1;
    } else {
      result += text[i];
    }
  }
  return result;
}

/** Split on unescaped occurrences of `sep`, preserving escape sequences. */
function splitUnescaped(text: string, sep: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\\" && i + 1 < text.length) {
      current += text[i] + text[i + 1];
      i += 1;
    } else if (text[i] === sep) {
      parts.push(current);
      current = "";
    } else {
      current += text[i];
    }
  }
  parts.push(current);
  return parts;
}

/** Build a column reference from its raw (still-escaped) colon-separated fields. */
function buildColumnRef(fields: string[], raw: string): ColumnRefNode {
  const name = unescapeText(fields[0]).trim();
  const labelRaw = fields.length >= 2 ? unescapeText(fields[1]).trim() : "";
  const label = labelRaw.length > 0 ? labelRaw : null;

  const constraints: Constraint[] = [];
  if (fields.length >= 3) {
    for (const rawPart of splitUnescaped(fields[2], ",")) {
      const trimmed = rawPart.trim();
      if (trimmed.length === 0) continue;
      // A leading unescaped `!` negates (a `\!` keeps the bang literal and
      // falls through to the reuse branch).
      if (trimmed.startsWith("!")) {
        const ref = unescapeText(trimmed.slice(1)).trim();
        if (ref.length > 0) constraints.push({ ref, negated: true });
      } else {
        const ref = unescapeText(trimmed).trim();
        if (ref.length > 0) constraints.push({ ref, negated: false });
      }
    }
  }

  return { kind: "columnRef", name, label, constraints, raw };
}

type SequenceStop = "close" | "prob" | "eof";

/**
 * Recursive-descent parser for the brainstorm grammar. Never throws: malformed
 * input (unclosed `{`/`[`, bad probabilities) degrades to literal text so a
 * half-typed pattern renders harmlessly instead of crashing the workspace.
 */
class PatternParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): Ast {
    return this.parseSequence(false).nodes;
  }

  private parseSequence(inOptional: boolean): {
    nodes: Node[];
    stop: SequenceStop;
  } {
    const nodes: Node[] = [];
    let literal = "";
    const flush = () => {
      if (literal.length > 0) {
        nodes.push({ kind: "literal", text: literal });
        literal = "";
      }
    };

    while (this.index < this.source.length) {
      const ch = this.source[this.index];

      if (ch === "\\") {
        const next = this.source[this.index + 1];
        literal += next ?? "\\";
        this.index += next !== undefined ? 2 : 1;
        continue;
      }

      if (inOptional && ch === "}") {
        flush();
        return { nodes, stop: "close" };
      }

      if (inOptional && ch === "|" && this.isProbabilityTerminator()) {
        flush();
        return { nodes, stop: "prob" };
      }

      if (ch === "{") {
        const save = this.index;
        const optional = this.parseOptional();
        if (optional) {
          flush();
          nodes.push(optional);
        } else {
          this.index = save + 1;
          literal += "{";
        }
        continue;
      }

      if (ch === "[") {
        const save = this.index;
        const ref = this.parseColumnRef();
        if (ref) {
          flush();
          nodes.push(ref);
        } else {
          this.index = save + 1;
          literal += "[";
        }
        continue;
      }

      literal += ch;
      this.index += 1;
    }

    flush();
    return { nodes, stop: "eof" };
  }

  /** `this.index` points at `{`. Returns null (no advance kept) when unclosed. */
  private parseOptional(): OptionalNode | null {
    this.index += 1; // consume '{'
    const { nodes, stop } = this.parseSequence(true);

    if (stop === "close") {
      this.index += 1; // consume '}'
      return { kind: "optional", probability: 0.5, children: nodes };
    }

    if (stop === "prob") {
      this.index += 1; // consume '|'
      const probability = this.readProbability(); // leaves index at '}'
      this.index += 1; // consume '}'
      return { kind: "optional", probability, children: nodes };
    }

    return null; // EOF: unclosed '{' degrades to literal
  }

  /** `this.index` points at `[`. Returns null (no advance) when unclosed. */
  private parseColumnRef(): ColumnRefNode | null {
    const start = this.index;
    let i = this.index + 1;
    const fields: string[] = [""];

    while (i < this.source.length) {
      const ch = this.source[i];

      if (ch === "\\") {
        const next = this.source[i + 1];
        fields[fields.length - 1] += ch + (next ?? "");
        i += next !== undefined ? 2 : 1;
        continue;
      }

      if (ch === "]") {
        const raw = this.source.slice(start, i + 1);
        this.index = i + 1;
        return buildColumnRef(fields, raw);
      }

      // Only the first two unescaped colons split fields; later colons are
      // literal text inside the constraints field.
      if (ch === ":" && fields.length < 3) {
        fields.push("");
        i += 1;
        continue;
      }

      fields[fields.length - 1] += ch;
      i += 1;
    }

    return null;
  }

  /** True when the `|` at `this.index` is followed by `<number>}`. */
  private isProbabilityTerminator(): boolean {
    return /^\|\s*(?:\d+\.?\d*|\.\d+)\s*\}/.test(this.source.slice(this.index));
  }

  /** Reads the probability after a `|`, clamps to `[0, 1]`, stops at `}`. */
  private readProbability(): number {
    const match = this.source
      .slice(this.index)
      .match(/^\s*(\d+\.?\d*|\.\d+)\s*/);
    if (!match) return 0.5;
    this.index += match[0].length;
    return Math.min(1, Math.max(0, Number.parseFloat(match[1])));
  }
}

/** Parse a brainstorm pattern into its AST. Pure; never throws. */
export function parseAst(pattern: string): Ast {
  return new PatternParser(pattern).parse();
}
