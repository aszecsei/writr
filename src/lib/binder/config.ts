/**
 * Whether the binder's nesting affordances are enabled, read from the
 * environment. Nesting is OFF unless `NEXT_PUBLIC_ENABLE_NESTING` is `true`/`1`.
 *
 * This gate is UI-only: it hides the "Add Nested…" action and disables the
 * horizontal drag-to-nest gesture. It does NOT change stored data — existing
 * nested chapters still render and compile as a tree.
 */
export function isNestingEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_ENABLE_NESTING;
  if (!value) return false;
  const flag = value.trim().toLowerCase();
  return flag === "true" || flag === "1";
}
