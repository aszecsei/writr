import { db } from "../database";
import { type CustomAgent, CustomAgentSchema } from "../schemas";
import { generateId, now } from "./helpers";

export type CreateCustomAgentInput = Pick<
  CustomAgent,
  "name" | "systemPrompt"
> &
  Partial<
    Pick<
      CustomAgent,
      | "projectId"
      | "description"
      | "allowedToolIds"
      | "modelOverride"
      | "assistantPrefill"
    >
  >;

export async function createCustomAgent(
  input: CreateCustomAgentInput,
): Promise<CustomAgent> {
  const timestamp = now();
  const agent = CustomAgentSchema.parse({
    id: generateId(),
    projectId: input.projectId ?? null,
    name: input.name,
    description: input.description ?? "",
    systemPrompt: input.systemPrompt,
    allowedToolIds: input.allowedToolIds ?? [],
    modelOverride: input.modelOverride ?? null,
    assistantPrefill: input.assistantPrefill ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.customAgents.add(agent);
  return agent;
}

export async function getCustomAgent(
  id: string,
): Promise<CustomAgent | undefined> {
  return db.customAgents.get(id);
}

export async function listCustomAgents(
  projectId: string | null,
): Promise<CustomAgent[]> {
  // Return both project-scoped and globally-defined (projectId=null) agents
  // for the project's editor. This lets users keep utility agents that work
  // across projects without copying them.
  const all = await db.customAgents.toArray();
  return all
    .filter(
      (a) =>
        a.projectId === null ||
        (projectId !== null && a.projectId === projectId),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateCustomAgent(
  id: string,
  data: Partial<
    Pick<
      CustomAgent,
      | "name"
      | "description"
      | "systemPrompt"
      | "allowedToolIds"
      | "modelOverride"
      | "assistantPrefill"
    >
  >,
): Promise<void> {
  await db.customAgents.update(id, { ...data, updatedAt: now() });
}

export async function deleteCustomAgent(id: string): Promise<void> {
  await db.customAgents.delete(id);
}
