import type { BrainstormColumn } from "@/db/schemas";
import type { ColumnRefNode, Node } from "./brainstorm-ast";
import { parseAst } from "./brainstorm-parser";
import { pickRandom, randomChance } from "./random";

interface FilledSegment {
  text: string;
  /**
   * True when this segment is an unresolved `[name]` left literal because the
   * column is unknown/empty, an exclusion ruled out every option, or a reuse
   * pointed at an unbound label. Plain text and resolved references are `false`.
   */
  isUnknownColumn: boolean;
}

export interface FillResult {
  /** The reconstructed pattern with each reference resolved (or left literal). */
  entry: string;
  /** Ordered segments for rendering (so unknown references can be flagged). */
  segments: FilledSegment[];
  /** True if any reference could not be resolved. */
  hasUnknown: boolean;
}

type Rng = <T>(items: readonly T[]) => T | undefined;

export interface FillOptions {
  /** Float source in `[0, 1)` for optional rolls. Defaults to `Math.random`. */
  random?: () => number;
}

/**
 * Fill a brainstorm pattern. Each `[column:label:constraints]` reference picks
 * a random option from its column; a `label` binds the pick so later references
 * can reuse it (bare constraint) or avoid it (`!` constraint). `{content|p}`
 * optionals emit their content with probability `p`. Bindings thread
 * left-to-right; an optional that does not fire leaves its labels unbound.
 *
 * Column names match case-insensitively after trimming. A reference is left as
 * its literal `[…]` text and flagged via `isUnknownColumn` / `hasUnknown` when
 * the column is unknown/empty, when exclusions rule out every option, or when a
 * reuse references a label that was never bound.
 */
export function fillPattern(
  pattern: string,
  columns: BrainstormColumn[],
  rng: Rng = pickRandom,
  options: FillOptions = {},
): FillResult {
  const random = options.random ?? Math.random;

  const byName = new Map<string, BrainstormColumn>();
  for (const column of columns) {
    byName.set(column.name.trim().toLowerCase(), column);
  }

  const bindings = new Map<string, string>();
  const segments: FilledSegment[] = [];
  let hasUnknown = false;

  const pushResolved = (text: string) => {
    segments.push({ text, isUnknownColumn: false });
  };
  const pushUnknown = (raw: string) => {
    segments.push({ text: raw, isUnknownColumn: true });
    hasUnknown = true;
  };

  const emitRef = (node: ColumnRefNode): void => {
    // Reuse: a bare-label constraint copies that label's bound value exactly,
    // ignoring the column's options.
    const reuse = node.constraints.find((constraint) => !constraint.negated);
    if (reuse) {
      const value = bindings.get(reuse.ref.toLowerCase());
      if (value === undefined) {
        pushUnknown(node.raw);
        return;
      }
      pushResolved(value);
      if (node.label) bindings.set(node.label.toLowerCase(), value);
      return;
    }

    const column = byName.get(node.name.toLowerCase());
    if (!column || column.options.length === 0) {
      pushUnknown(node.raw);
      return;
    }

    const excluded = new Set<string>();
    for (const constraint of node.constraints) {
      const bound = bindings.get(constraint.ref.toLowerCase());
      if (bound !== undefined) excluded.add(bound);
    }
    const candidates =
      excluded.size > 0
        ? column.options.filter((option) => !excluded.has(option))
        : column.options;
    if (candidates.length === 0) {
      pushUnknown(node.raw);
      return;
    }

    const value = rng(candidates);
    if (value === undefined) {
      pushUnknown(node.raw);
      return;
    }
    pushResolved(value);
    if (node.label) bindings.set(node.label.toLowerCase(), value);
  };

  const emit = (nodes: Node[]): void => {
    for (const node of nodes) {
      switch (node.kind) {
        case "literal":
          if (node.text.length > 0) pushResolved(node.text);
          break;
        case "optional":
          if (randomChance(node.probability, random)) emit(node.children);
          break;
        case "columnRef":
          emitRef(node);
          break;
      }
    }
  };

  emit(parseAst(pattern));

  return {
    entry: segments.map((segment) => segment.text).join(""),
    segments,
    hasUnknown,
  };
}

/** Distinct column names referenced by a pattern, in first-seen order. */
export function referencedColumnNames(pattern: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const visit = (nodes: Node[]): void => {
    for (const node of nodes) {
      if (node.kind === "columnRef") {
        const key = node.name.toLowerCase();
        if (node.name.length > 0 && !seen.has(key)) {
          seen.add(key);
          names.push(node.name);
        }
      } else if (node.kind === "optional") {
        visit(node.children);
      }
    }
  };
  visit(parseAst(pattern));
  return names;
}
