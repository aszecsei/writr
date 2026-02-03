import type {
  Chapter,
  Character,
  CharacterRelationship,
  Location,
  OutlineCard,
  OutlineColumn,
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

export function buildChapterNameMap(chapters: Chapter[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of chapters) {
    map.set(c.id, c.title);
  }
  return map;
}

function resolveNames(ids: string[], nameMap: Map<string, string>): string[] {
  return ids
    .map((id) => nameMap.get(id))
    .filter((name): name is string => name !== undefined);
}

export function serializeCharacter(c: Character): string {
  const attrs = c.pronouns
    ? ` role="${c.role}" pronouns="${c.pronouns}"`
    : ` role="${c.role}"`;

  const lines: string[] = [`<character name="${c.name}"${attrs}>`];

  if (c.aliases.length > 0)
    lines.push(`<aliases>${c.aliases.join(", ")}</aliases>`);
  if (c.description) lines.push(`<description>${c.description}</description>`);
  if (c.personality) lines.push(`<personality>${c.personality}</personality>`);
  if (c.motivations) lines.push(`<motivations>${c.motivations}</motivations>`);
  if (c.strengths) lines.push(`<strengths>${c.strengths}</strengths>`);
  if (c.weaknesses) lines.push(`<weaknesses>${c.weaknesses}</weaknesses>`);
  if (c.internalConflict)
    lines.push(`<internal-conflict>${c.internalConflict}</internal-conflict>`);
  if (c.characterArcs)
    lines.push(`<character-arcs>${c.characterArcs}</character-arcs>`);
  if (c.dialogueStyle)
    lines.push(`<dialogue-style>${c.dialogueStyle}</dialogue-style>`);
  if (c.backstory) lines.push(`<backstory>${c.backstory}</backstory>`);

  lines.push("</character>");
  return lines.join("\n");
}

export function serializeLocation(
  l: Location,
  charMap: Map<string, string>,
): string {
  const lines: string[] = [`<location name="${l.name}">`];

  if (l.description) lines.push(`<description>${l.description}</description>`);
  if (l.notes) lines.push(`<notes>${l.notes}</notes>`);

  const charNames = resolveNames(l.linkedCharacterIds, charMap);
  if (charNames.length > 0)
    lines.push(`<characters-here>${charNames.join(", ")}</characters-here>`);

  lines.push("</location>");
  return lines.join("\n");
}

export function serializeTimelineEvent(
  e: TimelineEvent,
  charMap: Map<string, string>,
): string {
  const dateAttr = e.date ? ` date="${e.date}"` : "";
  const lines: string[] = [`<event title="${e.title}"${dateAttr}>`];

  if (e.description) lines.push(`<description>${e.description}</description>`);

  const charNames = resolveNames(e.linkedCharacterIds, charMap);
  if (charNames.length > 0)
    lines.push(
      `<characters-involved>${charNames.join(", ")}</characters-involved>`,
    );

  lines.push("</event>");
  return lines.join("\n");
}

export function serializeStyleGuideEntry(s: StyleGuideEntry): string {
  return `<rule title="${s.title}">\n${s.content}\n</rule>`;
}

const WORLDBUILDING_TRUNCATE_LENGTH = 2048;

export function serializeWorldbuildingTree(docs: WorldbuildingDoc[]): string {
  const childrenOf = new Map<string | null, WorldbuildingDoc[]>();
  for (const d of docs) {
    const key = d.parentDocId;
    const list = childrenOf.get(key);
    if (list) list.push(d);
    else childrenOf.set(key, [d]);
  }

  function renderNode(doc: WorldbuildingDoc): string {
    const tagsAttr =
      doc.tags.length > 0 ? ` tags="${doc.tags.join(", ")}"` : "";
    const lines: string[] = [`<doc title="${doc.title}"${tagsAttr}>`];

    if (doc.content) {
      const truncated =
        doc.content.length > WORLDBUILDING_TRUNCATE_LENGTH
          ? `${doc.content.slice(0, WORLDBUILDING_TRUNCATE_LENGTH)}...`
          : doc.content;
      lines.push(truncated);
    }

    const children = childrenOf.get(doc.id);
    if (children) {
      for (const child of children) {
        lines.push(renderNode(child));
      }
    }

    lines.push("</doc>");
    return lines.join("\n");
  }

  const roots = childrenOf.get(null) ?? [];
  return roots.map(renderNode).join("\n");
}

export function serializeRelationship(
  r: CharacterRelationship,
  charMap: Map<string, string>,
): string {
  const sourceName = charMap.get(r.sourceCharacterId);
  const targetName = charMap.get(r.targetCharacterId);
  if (!sourceName || !targetName) return "";

  const label = r.type === "custom" && r.customLabel ? r.customLabel : r.type;
  return `<relationship source="${sourceName}" target="${targetName}" type="${label}" />`;
}

const OUTLINE_CARD_TRUNCATE_LENGTH = 1024;

export function serializeOutline(
  columns: OutlineColumn[],
  cards: OutlineCard[],
  charMap: Map<string, string>,
  locationMap: Map<string, string>,
  chapterMap: Map<string, string>,
): string {
  const sorted = [...columns].sort((a, b) => a.order - b.order);

  const cardsByColumn = new Map<string, OutlineCard[]>();
  for (const card of cards) {
    const list = cardsByColumn.get(card.columnId);
    if (list) list.push(card);
    else cardsByColumn.set(card.columnId, [card]);
  }
  for (const list of cardsByColumn.values()) {
    list.sort((a, b) => a.order - b.order);
  }

  const lines: string[] = [];
  for (const col of sorted) {
    lines.push(`<column title="${col.title}">`);

    const colCards = cardsByColumn.get(col.id) ?? [];
    for (const card of colCards) {
      lines.push(`<card title="${card.title}">`);

      if (card.content) {
        const truncated =
          card.content.length > OUTLINE_CARD_TRUNCATE_LENGTH
            ? `${card.content.slice(0, OUTLINE_CARD_TRUNCATE_LENGTH)}...`
            : card.content;
        lines.push(`<notes>${truncated}</notes>`);
      }

      const chapterNames = resolveNames(card.linkedChapterIds, chapterMap);
      if (chapterNames.length > 0)
        lines.push(
          `<linked-chapters>${chapterNames.join(", ")}</linked-chapters>`,
        );

      const charNames = resolveNames(card.linkedCharacterIds, charMap);
      if (charNames.length > 0)
        lines.push(
          `<linked-characters>${charNames.join(", ")}</linked-characters>`,
        );

      const locNames = resolveNames(card.linkedLocationIds, locationMap);
      if (locNames.length > 0)
        lines.push(
          `<linked-locations>${locNames.join(", ")}</linked-locations>`,
        );

      lines.push("</card>");
    }

    lines.push("</column>");
  }

  return lines.join("\n");
}
