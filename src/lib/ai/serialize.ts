import type {
  Character,
  CharacterRelationship,
  Location,
  StyleGuideEntry,
  TimelineEvent,
  WorldbuildingDoc,
} from "@/db/schemas";

export function buildCharacterNameMap(
  characters: Character[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of characters) {
    map.set(c.id, c.name);
  }
  return map;
}

export function buildLocationNameMap(
  locations: Location[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const l of locations) {
    map.set(l.id, l.name);
  }
  return map;
}

function resolveNames(ids: string[], nameMap: Map<string, string>): string[] {
  return ids
    .map((id) => nameMap.get(id))
    .filter((name): name is string => name !== undefined);
}

export function serializeCharacter(c: Character): string {
  const header = c.pronouns
    ? `**${c.name}** (${c.role}, ${c.pronouns})`
    : `**${c.name}** (${c.role})`;

  const lines: string[] = [header];

  if (c.aliases.length > 0) lines.push(`Aliases: ${c.aliases.join(", ")}`);
  if (c.description) lines.push(`Description: ${c.description}`);
  if (c.personality) lines.push(`Personality: ${c.personality}`);
  if (c.motivations) lines.push(`Motivations: ${c.motivations}`);
  if (c.strengths || c.weaknesses) {
    const parts: string[] = [];
    if (c.strengths) parts.push(`Strengths: ${c.strengths}`);
    if (c.weaknesses) parts.push(`Weaknesses: ${c.weaknesses}`);
    lines.push(parts.join(" | "));
  }
  if (c.internalConflict)
    lines.push(`Internal Conflict: ${c.internalConflict}`);
  if (c.characterArcs) lines.push(`Character Arcs: ${c.characterArcs}`);
  if (c.dialogueStyle) lines.push(`Dialogue Style: ${c.dialogueStyle}`);
  if (c.backstory) lines.push(`Backstory: ${c.backstory}`);

  return lines.join("\n");
}

export function serializeLocation(
  l: Location,
  charMap: Map<string, string>,
): string {
  const lines: string[] = [`**${l.name}**`];

  if (l.description) lines.push(`Description: ${l.description}`);
  if (l.notes) lines.push(`Notes: ${l.notes}`);

  const charNames = resolveNames(l.linkedCharacterIds, charMap);
  if (charNames.length > 0)
    lines.push(`Characters here: ${charNames.join(", ")}`);

  return lines.join("\n");
}

export function serializeTimelineEvent(
  e: TimelineEvent,
  charMap: Map<string, string>,
): string {
  const header = e.date ? `**${e.title}** (${e.date})` : `**${e.title}**`;
  const lines: string[] = [header];

  if (e.description) lines.push(`Description: ${e.description}`);

  const charNames = resolveNames(e.linkedCharacterIds, charMap);
  if (charNames.length > 0)
    lines.push(`Characters involved: ${charNames.join(", ")}`);

  return lines.join("\n");
}

export function serializeStyleGuideEntry(s: StyleGuideEntry): string {
  return `### ${s.title}\n${s.content}`;
}

const WORLDBUILDING_TRUNCATE_LENGTH = 200;

export function serializeWorldbuildingDoc(d: WorldbuildingDoc): string {
  const tags = d.tags.length > 0 ? ` [${d.tags.join(", ")}]` : "";
  const lines: string[] = [`**${d.title}**${tags}`];

  if (d.content) {
    const truncated =
      d.content.length > WORLDBUILDING_TRUNCATE_LENGTH
        ? `${d.content.slice(0, WORLDBUILDING_TRUNCATE_LENGTH)}...`
        : d.content;
    lines.push(truncated);
  }

  return lines.join("\n");
}

export function serializeRelationship(
  r: CharacterRelationship,
  charMap: Map<string, string>,
): string {
  const sourceName = charMap.get(r.sourceCharacterId);
  const targetName = charMap.get(r.targetCharacterId);
  if (!sourceName || !targetName) return "";

  const label = r.type === "custom" && r.customLabel ? r.customLabel : r.type;
  return `${sourceName} → ${targetName} (${label})`;
}
