import { getAgentByKind } from "@/db/operations/agents";
import { PIPELINE_AGENT_KINDS } from "@/db/schemas";
import type { Agent } from "./types";

/**
 * Pull the corresponding AgentDefinition row's `modelOverride` onto a freshly-
 * constructed pipeline Agent, so per-agent model config configured in the
 * Manage Agents UI flows to pipeline runs.
 *
 * No-op for chat agents (those already have their override set at construction
 * by the chat factory) and for "manual" / "custom" runtime kinds.
 */
export async function applyDefinitionOverride(agent: Agent): Promise<void> {
  if (agent.modelOverride) return;
  if (!PIPELINE_AGENT_KINDS.has(agent.kind as never)) return;
  const def = await getAgentByKind(agent.kind as never);
  if (def.modelOverride) {
    agent.modelOverride = def.modelOverride;
  }
}
