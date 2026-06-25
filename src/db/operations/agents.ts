import { db } from "../database";
import {
  type AgentDefinition,
  type AgentDefinitionId,
  AgentDefinitionSchema,
  type AgentKind,
  type ProjectId,
} from "../schemas";
import { generateId, now } from "./helpers";

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
 * Singleton lookup for built-in agents. Returns the (single) row of the
 * given kind. Throws if no row exists — callers should rely on
 * `seedBuiltinAgents()` having run on app boot.
 */
export async function getAgentByKind(
  kind: Exclude<AgentKind, "user">,
): Promise<AgentDefinition> {
  const all = await db.agents.where("kind").equals(kind).toArray();
  if (all.length === 0) {
    throw new Error(
      `Built-in agent of kind "${kind}" is missing. Try refreshing — the seed runs on boot.`,
    );
  }
  // Defensive: in the unlikely case duplicates exist, prefer the oldest.
  all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return all[0];
}

/**
 * Agents available for project-scoped operations. Includes:
 *   - All built-in chat agents (kind in CHAT_AGENT_KINDS minus "user").
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
  await db.agents.update(id, { ...data, updatedAt: now() });
}

export async function deleteAgent(id: AgentDefinitionId): Promise<void> {
  // Built-in agents are not user-deletable. Callers (the AgentsManager UI)
  // gate the delete button by kind; this is a defense-in-depth check.
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

/**
 * Idempotently create the built-in agent rows if they're missing. Called on
 * app boot so a freshly-installed user (or a user whose v32 migration left
 * gaps) gets a complete set of built-ins. The v32 migration seeds these
 * during upgrade; this is the second line of defense.
 */
export async function seedBuiltinAgents(): Promise<void> {
  const { BUILTIN_AGENT_DEFAULTS } = await import(
    "@/lib/ai/agents/builtins/defaults"
  );
  const builtinKinds = Object.keys(BUILTIN_AGENT_DEFAULTS) as Array<
    Exclude<AgentKind, "user">
  >;

  const existing = await db.agents.toArray();
  const existingByKind = new Map<string, AgentDefinition[]>();
  for (const row of existing) {
    if (row.kind === "user") continue;
    const list = existingByKind.get(row.kind) ?? [];
    list.push(row);
    existingByKind.set(row.kind, list);
  }

  const timestamp = now();
  for (const kind of builtinKinds) {
    if (existingByKind.has(kind)) continue;
    const def = BUILTIN_AGENT_DEFAULTS[kind];
    await db.agents.add(
      AgentDefinitionSchema.parse({
        id: generateId(),
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
      }),
    );
  }
}

/** True if the agent is one of the built-in kinds (not user-created). */
export function isBuiltinAgent(agent: AgentDefinition): boolean {
  return agent.kind !== "user";
}
