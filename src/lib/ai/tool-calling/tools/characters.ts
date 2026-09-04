import { z } from "zod";
import {
  createCharacter,
  deleteCharacter,
  getCharacter,
  updateCharacter,
} from "@/db/operations/characters";
import { type CharacterId, CharacterRoleEnum } from "@/db/schemas";
import { defineTool } from "../types";
import { fail, ok } from "./helpers";

export const createCharacterTool = defineTool({
  id: "create_character",
  name: "Create Character",
  description:
    "Create a new character in the story bible. Use when the user asks to add a character.",
  inputSchema: z.object({
    name: z.string().min(1).describe("Character name"),
    role: CharacterRoleEnum.describe("Character role").optional(),
    summary: z
      .string()
      .describe("Brief overview of who the character is")
      .optional(),
    description: z
      .string()
      .describe(
        "Physical description — appearance, distinguishing features, mannerisms",
      )
      .optional(),
    personality: z.string().describe("Personality traits").optional(),
    backstory: z.string().describe("Character backstory").optional(),
  }),
  requiresApproval: true,
  async execute(params, context) {
    const character = await createCharacter({
      projectId: context.projectId,
      name: params.name,
      role: params.role,
      summary: params.summary,
      description: params.description,
      personality: params.personality,
      backstory: params.backstory,
    });
    return ok(`Created character "${character.name}"`, {
      id: character.id,
      name: character.name,
    });
  },
});

export const updateCharacterTool = defineTool({
  id: "update_character",
  name: "Update Character",
  description:
    "Update fields on an existing character. Only include fields to change. " +
    "Use the `list` and `get` tools first to discover the character id.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Character ID"),
    name: z.string().describe("New name").optional(),
    role: CharacterRoleEnum.describe("New role").optional(),
    summary: z
      .string()
      .describe("New summary — a brief overview of who the character is")
      .optional(),
    description: z
      .string()
      .describe("New physical description (appearance)")
      .optional(),
    personality: z.string().describe("New personality").optional(),
    backstory: z.string().describe("New backstory").optional(),
    motivations: z.string().describe("New motivations").optional(),
    strengths: z.string().describe("New strengths").optional(),
    weaknesses: z.string().describe("New weaknesses").optional(),
    dialogueStyle: z.string().describe("New dialogue style").optional(),
  }),
  requiresApproval: true,
  async execute(params) {
    const { id, ...fields } = params;
    const existing = await getCharacter(id as CharacterId);
    if (!existing) return fail(`Character not found: ${id}`);
    await updateCharacter(id as CharacterId, fields);
    return ok(`Updated character "${existing.name}"`);
  },
});

export const deleteCharacterTool = defineTool({
  id: "delete_character",
  name: "Delete Character",
  description:
    "Delete a character from the story bible. Also removes the character's " +
    "relationships. Use the `list` and `get` tools first to confirm the id.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Character ID"),
  }),
  requiresApproval: true,
  async execute(params) {
    const existing = await getCharacter(params.id as CharacterId);
    if (!existing) return fail(`Character not found: ${params.id}`);
    await deleteCharacter(params.id as CharacterId);
    return ok(`Deleted character "${existing.name}"`);
  },
});
