import { z } from "zod";
import {
  createCharacter,
  getCharacter,
  updateCharacter,
} from "@/db/operations/characters";
import { type CharacterId, CharacterRoleEnum } from "@/db/schemas";
import { defineTool } from "../types";
import { fail, ok } from "./helpers";

export const createCharacterTool = defineTool({
  id: "create_character",
  category: "character",
  name: "Create Character",
  description:
    "Create a new character in the story bible. Use when the user asks to add a character.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Character name" },
      role: {
        type: "string",
        description: "Character role",
        enum: ["protagonist", "antagonist", "supporting", "minor"],
      },
      description: { type: "string", description: "Brief description" },
      personality: { type: "string", description: "Personality traits" },
      backstory: { type: "string", description: "Character backstory" },
    },
    required: ["name"],
  },
  inputSchema: z
    .object({
      name: z.string().min(1),
      role: CharacterRoleEnum.optional(),
      description: z.string().optional(),
      personality: z.string().optional(),
      backstory: z.string().optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params, context) {
    const character = await createCharacter({
      projectId: context.projectId,
      name: params.name,
      role: params.role ?? undefined,
      description: params.description ?? undefined,
      personality: params.personality ?? undefined,
      backstory: params.backstory ?? undefined,
    });
    return ok(`Created character "${character.name}"`, {
      id: character.id,
      name: character.name,
    });
  },
});

export const updateCharacterTool = defineTool({
  id: "update_character",
  category: "character",
  name: "Update Character",
  description:
    "Update fields on an existing character. Only include fields to change. " +
    "Use the `list` and `get` tools first to discover the character id.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Character ID" },
      name: { type: "string", description: "New name" },
      role: {
        type: "string",
        description: "New role",
        enum: ["protagonist", "antagonist", "supporting", "minor"],
      },
      description: { type: "string", description: "New description" },
      personality: { type: "string", description: "New personality" },
      backstory: { type: "string", description: "New backstory" },
      motivations: { type: "string", description: "New motivations" },
      strengths: { type: "string", description: "New strengths" },
      weaknesses: { type: "string", description: "New weaknesses" },
      dialogueStyle: { type: "string", description: "New dialogue style" },
    },
    required: ["id"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      name: z.string().optional(),
      role: CharacterRoleEnum.optional(),
      description: z.string().optional(),
      personality: z.string().optional(),
      backstory: z.string().optional(),
      motivations: z.string().optional(),
      strengths: z.string().optional(),
      weaknesses: z.string().optional(),
      dialogueStyle: z.string().optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params) {
    const { id, ...fields } = params;
    const existing = await getCharacter(id as CharacterId);
    if (!existing) return fail(`Character not found: ${id}`);
    await updateCharacter(id as CharacterId, fields);
    return ok(`Updated character "${existing.name}"`);
  },
});
