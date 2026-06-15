import type { Character, Location } from "@/db/schemas";

export interface MentionedEntities {
  characterIds: Set<string>;
  locationIds: Set<string>;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentions(text: string, name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 3) return false;
  const re = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, "i");
  return re.test(text);
}

/**
 * Deterministic entity-link signal: which characters/locations are named in the
 * given text. Used to force relevant worldbuilding docs into retrieval even
 * when pure semantic similarity would miss them.
 */
export function findMentionedEntityIds(
  text: string,
  characters: readonly Character[],
  locations: readonly Location[],
): MentionedEntities {
  const characterIds = new Set<string>();
  const locationIds = new Set<string>();
  for (const c of characters)
    if (mentions(text, c.name)) characterIds.add(c.id);
  for (const l of locations) if (mentions(text, l.name)) locationIds.add(l.id);
  return { characterIds, locationIds };
}
