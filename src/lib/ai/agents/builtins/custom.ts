import type { CustomAgent } from "@/db/schemas";
import type { AiContext } from "../../types";
import { makeAgentBuildMessages } from "../build-messages";
import type { Agent } from "../types";

export interface MakeCustomAgentInput {
  custom: CustomAgent;
  projectId: string;
  context: AiContext;
}

/**
 * Build a runnable Agent from a saved CustomAgent row. User-defined agents
 * live in the `customAgents` Dexie table — this factory turns them into the
 * shape the runner expects.
 *
 * Custom agents skip the legacy task-tool flow entirely; their systemPrompt
 * is used verbatim. They can specify a tool whitelist and a model override.
 */
export function makeCustomAgent(input: MakeCustomAgentInput): Agent {
  const enableToolCalling = input.custom.allowedToolIds.length > 0;
  return {
    id: `custom:${input.custom.id}`,
    kind: "custom",
    enableToolCalling,
    allowedToolIds: input.custom.allowedToolIds,
    modelOverride: input.custom.modelOverride ?? undefined,
    buildMessages: makeAgentBuildMessages({
      systemPrompt: input.custom.systemPrompt,
      context: input.context,
      enableToolCalling,
      assistantPrefill: input.custom.assistantPrefill || undefined,
    }),
    agentContext: {
      projectId: input.projectId,
      agentKind: "custom",
    },
    systemPrompt: input.custom.systemPrompt,
  };
}
