import { BUILTIN_AGENT_DEFAULTS } from "@/lib/ai/agents/builtins/defaults";
import { db } from "../database";
import {
  type AgentDefinition,
  type AgentDefinitionId,
  AgentDefinitionSchema,
  type AgentKind,
  type ProjectId,
} from "../schemas";
import { generateId, now, stripUndefined } from "./helpers";
import { appliesToProject } from "./scope";

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

// A plain function, not `createCrud`: database.ts imports this module for
// the built-in agent seed, and a factory call at module scope here would
// dereference `db.agents` before the `db` export it closes over is assigned,
// throwing at import time.
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
  return all.filter((a) => a.kind !== "user" || appliesToProject(a, projectId));
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

/**
 * Idempotent built-in agent seed: covers fresh installs and any case where a
 * built-in row went missing. Existing rows (including user edits) are left
 * untouched.
 */
export async function seedBuiltinAgents(): Promise<void> {
  const timestamp = now();
  const existing = await db.agents.toArray();
  const presentKinds = new Set(
    existing.filter((a) => a.kind !== "user").map((a) => a.kind),
  );
  const builtinKinds = Object.keys(
    BUILTIN_AGENT_DEFAULTS,
  ) as (keyof typeof BUILTIN_AGENT_DEFAULTS)[];
  for (const kind of builtinKinds) {
    if (presentKinds.has(kind)) continue;
    const def = BUILTIN_AGENT_DEFAULTS[kind];
    await db.agents.add({
      id: generateId() as AgentDefinitionId,
      kind,
      projectId: null,
      name: def.name,
      description: def.description,
      systemPrompt: def.systemPrompt,
      allowedToolIds: def.allowedToolIds,
      modelOverride: null,
      assistantPrefill: def.assistantPrefill ?? "",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
}
