/**
 * AST for the brainstorm pattern grammar. Shared by the parser
 * (`brainstorm-parser.ts`) and the evaluator (`brainstorm.ts`).
 *
 * Grammar surface:
 * - `[column:label:constraints]` — a column reference. `label` binds the pick
 *   for later reuse; each constraint is a label ref (`!x` = differ from `x`,
 *   bare `x` = reuse `x`'s value).
 * - `{content|p}` — an optional emitted with probability `p` (default 0.5).
 * - everything else is literal text.
 */

/** A run of literal text (already un-escaped). */
export interface LiteralNode {
  kind: "literal";
  text: string;
}

/** One entry in a reference's constraint list. */
export interface Constraint {
  /** Referenced label name, trimmed (compared case-insensitively). */
  ref: string;
  /** `true` for `!ref` (must differ); `false` for a bare `ref` (reuse value). */
  negated: boolean;
}

/** A `[column:label:constraints]` reference. */
export interface ColumnRefNode {
  kind: "columnRef";
  /** Column name, trimmed. */
  name: string;
  /** Label to bind the chosen value to, or `null` when omitted/empty. */
  label: string | null;
  constraints: Constraint[];
  /** Original `[...]` source slice, emitted verbatim when unresolved. */
  raw: string;
}

/** A `{content|p}` optional. */
export interface OptionalNode {
  kind: "optional";
  /** Probability in `[0, 1]` that `children` are emitted. */
  probability: number;
  children: Node[];
}

export type Node = LiteralNode | ColumnRefNode | OptionalNode;

/** A parsed pattern: an ordered top-level sequence of nodes. */
export type Ast = Node[];
