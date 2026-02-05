import { db } from "../database";
import {
  type Character,
  type CharacterRelationship,
  CharacterRelationshipSchema,
  CharacterSchema,
} from "../schemas";
import { generateId, now } from "./helpers";

// ─── Characters ──────────────────────────────────────────────────────

export async function getCharactersByProject(
  projectId: string,
): Promise<Character[]> {
  return db.characters.where({ projectId }).sortBy("name");
}

export async function getCharacter(id: string): Promise<Character | undefined> {
  return db.characters.get(id);
}

export async function createCharacter(
  data: Pick<Character, "projectId" | "name"> &
    Partial<
      Pick<
        Character,
        | "role"
        | "pronouns"
        | "aliases"
        | "description"
        | "personality"
        | "motivations"
        | "internalConflict"
        | "strengths"
        | "weaknesses"
        | "characterArcs"
        | "dialogueStyle"
        | "backstory"
        | "notes"
        | "linkedCharacterIds"
        | "linkedLocationIds"
      >
    >,
): Promise<Character> {
  const character = CharacterSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    name: data.name,
    role: data.role ?? "supporting",
    pronouns: data.pronouns ?? "",
    aliases: data.aliases ?? [],
    description: data.description ?? "",
    personality: data.personality ?? "",
    motivations: data.motivations ?? "",
    internalConflict: data.internalConflict ?? "",
    strengths: data.strengths ?? "",
    weaknesses: data.weaknesses ?? "",
    characterArcs: data.characterArcs ?? "",
    dialogueStyle: data.dialogueStyle ?? "",
    backstory: data.backstory ?? "",
    notes: data.notes ?? "",
    linkedCharacterIds: data.linkedCharacterIds ?? [],
    linkedLocationIds: data.linkedLocationIds ?? [],
    createdAt: now(),
    updatedAt: now(),
  });
  await db.characters.add(character);
  return character;
}

export async function updateCharacter(
  id: string,
  data: Partial<Omit<Character, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  await db.characters.update(id, { ...data, updatedAt: now() });
}

export async function deleteCharacter(id: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.characters, db.characterRelationships],
    async () => {
      await db.characterRelationships
        .where("sourceCharacterId")
        .equals(id)
        .delete();
      await db.characterRelationships
        .where("targetCharacterId")
        .equals(id)
        .delete();
      await db.characters.delete(id);
    },
  );
}

// ─── Character Relationships ────────────────────────────────────────

export async function getRelationshipsByProject(
  projectId: string,
): Promise<CharacterRelationship[]> {
  return db.characterRelationships.where({ projectId }).toArray();
}

export async function createRelationship(
  data: Pick<
    CharacterRelationship,
    "projectId" | "sourceCharacterId" | "targetCharacterId" | "type"
  > &
    Partial<Pick<CharacterRelationship, "customLabel">>,
): Promise<CharacterRelationship> {
  if (data.sourceCharacterId === data.targetCharacterId) {
    throw new Error("A character cannot have a relationship with itself.");
  }

  // Prevent exact duplicates (same pair + type + label)
  const existing = await db.characterRelationships
    .where({ projectId: data.projectId })
    .toArray();

  const customLabel = data.customLabel ?? "";
  const isDuplicate = existing.some(
    (r) =>
      r.type === data.type &&
      r.customLabel === customLabel &&
      ((r.sourceCharacterId === data.sourceCharacterId &&
        r.targetCharacterId === data.targetCharacterId) ||
        (r.sourceCharacterId === data.targetCharacterId &&
          r.targetCharacterId === data.sourceCharacterId)),
  );

  if (isDuplicate) {
    throw new Error("This exact relationship already exists.");
  }

  const relationship = CharacterRelationshipSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    sourceCharacterId: data.sourceCharacterId,
    targetCharacterId: data.targetCharacterId,
    type: data.type,
    customLabel,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.characterRelationships.add(relationship);
  return relationship;
}

export async function updateRelationship(
  id: string,
  data: Partial<Pick<CharacterRelationship, "type" | "customLabel">>,
): Promise<void> {
  await db.characterRelationships.update(id, { ...data, updatedAt: now() });
}

export async function deleteRelationship(id: string): Promise<void> {
  await db.characterRelationships.delete(id);
}
