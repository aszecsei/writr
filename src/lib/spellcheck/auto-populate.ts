import type { Character, Location } from "@/db/schemas";

/**
 * Extract names from story bible entities that should be recognized as valid words.
 * This includes character names, aliases, and location names.
 */
export function extractNamesFromBible(
  characters: Character[],
  locations: Location[],
): string[] {
  const names: string[] = [];

  for (const char of characters) {
    // Add character name (split on spaces to get individual words)
    const nameParts = char.name.split(/\s+/);
    for (const part of nameParts) {
      const cleaned = part.toLowerCase().trim();
      if (cleaned.length >= 2) {
        names.push(cleaned);
        names.push(`${cleaned}'s`);
      }
    }

    // Add aliases
    if (char.aliases) {
      for (const alias of char.aliases) {
        const aliasParts = alias.split(/\s+/);
        for (const part of aliasParts) {
          const cleaned = part.toLowerCase().trim();
          if (cleaned.length >= 2) {
            names.push(cleaned);
            names.push(`${cleaned}'s`);
          }
        }
      }
    }
  }

  for (const loc of locations) {
    // Add location name (split on spaces to get individual words)
    const nameParts = loc.name.split(/\s+/);
    for (const part of nameParts) {
      const cleaned = part.toLowerCase().trim();
      if (cleaned.length >= 2) {
        names.push(cleaned);
      }
    }
  }

  // Deduplicate
  return [...new Set(names)];
}

/**
 * Create a Set of custom words combining dictionary words and story bible names.
 */
export function combineCustomWords(
  dictionaryWords: Set<string>,
  characters: Character[],
  locations: Location[],
): Set<string> {
  const combined = new Set(dictionaryWords);

  const bibleNames = extractNamesFromBible(characters, locations);
  for (const name of bibleNames) {
    combined.add(name);
  }

  return combined;
}
