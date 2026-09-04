import { db } from "../database";
import {
  type AgentDefinition,
  type AgentDefinitionId,
  AgentDefinitionSchema,
  type AgentKind,
  type ProjectId,
} from "../schemas";
import { generateId, now, stripUndefined } from "./helpers";

export type CreateAgentInput = {
  kind: AgentKind;
  name: string;
  systemPrompt: string;
} & Partial<
  Pick<
    AgentDefinition,
    | "projectId"
    | "description"
    | "allowedToolIds"
    | "modelOverride"
    | "assistantPrefill"
  >
>;

export async function createAgent(
  input: CreateAgentInput,
): Promise<AgentDefinition> {
  const timestamp = now();
  const agent = AgentDefinitionSchema.parse({
    id: generateId(),
    kind: input.kind,
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
  await db.agents.add(agent);
  return agent;
}

export async function getAgent(
  id: AgentDefinitionId,
): Promise<AgentDefinition | undefined> {
  return db.agents.get(id);
}

/**
 * Agents available for project-scoped operations. Includes:
 *   - All built-in chat agents (every kind except "user").
 *   - User-created agents that are global (projectId=null) or scoped to
 *     this project.
 */
export async function listAgents(
  projectId: ProjectId | null,
): Promise<AgentDefinition[]> {
  const all = await db.agents.toArray();
  return all.filter((a) =>
    a.kind === "user"
      ? a.projectId === null ||
        (projectId !== null && a.projectId === projectId)
      : true,
  );
}

export async function updateAgent(
  id: AgentDefinitionId,
  data: Partial<
    Pick<
      AgentDefinition,
      | "name"
      | "description"
      | "systemPrompt"
      | "allowedToolIds"
      | "modelOverride"
      | "assistantPrefill"
      | "projectId"
    >
  >,
): Promise<void> {
  await db.agents.update(id, { ...stripUndefined(data), updatedAt: now() });
}

export async function deleteAgent(id: AgentDefinitionId): Promise<void> {
  // Built-in agents are not user-deletable; this is a defense-in-depth check.
  const existing = await db.agents.get(id);
  if (!existing) return;
  if (existing.kind !== "user") {
    throw new Error(
      `Cannot delete built-in agent "${existing.kind}". Use resetAgentToDefaults instead.`,
    );
  }
  await db.agents.delete(id);
}

/**
 * Restore a built-in agent's editable fields from the bundled defaults. No-op
 * for `kind="user"` agents (they have no canonical default to revert to).
 */
export async function resetAgentToDefaults(
  id: AgentDefinitionId,
): Promise<void> {
  const existing = await db.agents.get(id);
  if (!existing || existing.kind === "user") return;

  // Lazy-import the defaults to avoid pulling AI runtime modules into every
  // operation consumer.
  const { BUILTIN_AGENT_DEFAULTS } = await import(
    "@/lib/ai/agents/builtins/defaults"
  );
  const def = BUILTIN_AGENT_DEFAULTS[existing.kind];
  if (!def) return;

  await db.agents.update(id, {
    name: def.name,
    description: def.description,
    systemPrompt: def.systemPrompt,
    allowedToolIds: def.allowedToolIds,
    modelOverride: null,
    assistantPrefill: def.assistantPrefill ?? "",
    updatedAt: now(),
  });
}
