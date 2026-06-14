/** Pick one element from `items` uniformly at random, or `undefined` if empty. */
export function pickRandom<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Return `true` with probability `p` (clamped to `[0, 1]`). `random` is the
 * injectable float source (returning a value in `[0, 1)`) so callers can make
 * the outcome deterministic in tests.
 */
export function randomChance(
  p: number,
  random: () => number = Math.random,
): boolean {
  if (p <= 0) return false;
  if (p >= 1) return true;
  return random() < p;
}
