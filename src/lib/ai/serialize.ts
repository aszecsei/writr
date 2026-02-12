import type {
  Character,
  CharacterRelationship,
  Location,
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow,
  StyleGuideEntry,
  TimelineEvent,
  WorldbuildingDoc,
} from "@/db/schemas";

export function buildNameMap<T extends { id: string }>(
  items: T[],
  getName: (item: T) => string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(item.id, getName(item));
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

export function serializeOutlineGrid(
  columns: OutlineGridColumn[],
  rows: OutlineGridRow[],
  cells: OutlineGridCell[],
  chapterMap: Map<string, string>,
): string {
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);
  const sortedRows = [...rows].sort((a, b) => a.order - b.order);

  const cellMap = new Map<string, OutlineGridCell>();
  for (const cell of cells) {
    cellMap.set(`${cell.rowId}:${cell.columnId}`, cell);
  }

  const lines: string[] = [];

  lines.push("<columns>");
  for (const col of sortedColumns) {
    lines.push(`<column>${col.title}</column>`);
  }
  lines.push("</columns>");

  lines.push("<rows>");
  for (const row of sortedRows) {
    const chapterName = row.linkedChapterId
      ? chapterMap.get(row.linkedChapterId)
      : null;
    const label = chapterName || row.label || "Untitled";
    const chapterAttr = chapterName ? ` chapter="${chapterName}"` : "";

    lines.push(`<row label="${label}"${chapterAttr}>`);
    for (const col of sortedColumns) {
      const cell = cellMap.get(`${row.id}:${col.id}`);
      if (cell?.content) {
        lines.push(`<cell column="${col.title}">${cell.content}</cell>`);
      }
    }
    lines.push("</row>");
  }
  lines.push("</rows>");

  return lines.join("\n");
}
