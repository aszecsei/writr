import type { AgentDefinition, ProjectId } from "@/db/schemas";
import type { AiContext } from "../../types";
import { makeChatAgentBuildMessages } from "../build-messages";
import type { Agent } from "../types";
import { withScreenplaySuffix } from "./screenplay";
import { withVoiceMandate } from "./voice";

export interface MakeChatAgentInput {
  definition: AgentDefinition;
  projectId: ProjectId;
  context: AiContext;
  /** App-level user customization, applied as a preamble. */
  customSystemPrompt?: string | null;
  /** Pre-task user instructions injected into the Nth-last user message. */
  postChatInstructions?: string;
  postChatInstructionsDepth?: number;
}

/**
 * Build a runnable Agent from an AgentDefinition row, suitable for AiPanel
 * chat invocations. Handles every built-in kind and `kind="user"` rows
 * uniformly — all of them are just "system prompt + tool subset + optional
 * model override".
 */
export function makeChatAgent(input: MakeChatAgentInput): Agent {
  const { definition, projectId, context } = input;
  const enableToolCalling = definition.allowedToolIds.length > 0;

  // Stored row content is the role description only; the shared voice
  // mandate is applied at runtime so it isn't duplicated in every
  // agentDefinition row.
  const baseSystemPrompt = withVoiceMandate(definition.systemPrompt);
  const systemPrompt = withScreenplaySuffix(baseSystemPrompt, context);

  return {
    kind: definition.kind === "user" ? "custom" : definition.kind,
    enableToolCalling,
    allowedToolIds: enableToolCalling ? definition.allowedToolIds : undefined,
    modelOverride: definition.modelOverride ?? undefined,
    buildMessages: makeChatAgentBuildMessages({
      systemPrompt,
      context,
      enableToolCalling,
      assistantPrefill: definition.assistantPrefill || undefined,
      customSystemPrompt: input.customSystemPrompt,
      postChatInstructions: input.postChatInstructions,
      postChatInstructionsDepth: input.postChatInstructionsDepth,
    }),
    agentContext: {
      projectId,
    },
    systemPrompt,
  };
}
