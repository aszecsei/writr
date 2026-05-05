import type { AgentDefinition } from "@/db/schemas";
import type { AiContext } from "../../types";
import { makeChatAgentBuildMessages } from "../build-messages";
import type { Agent } from "../types";
import { withScreenplaySuffix } from "./screenplay";

export interface MakeChatAgentInput {
  definition: AgentDefinition;
  projectId: string;
  context: AiContext;
  /** App-level user customization, applied as a preamble. */
  customSystemPrompt?: string | null;
  /** Pre-task user instructions injected into the Nth-last user message. */
  postChatInstructions?: string;
  postChatInstructionsDepth?: number;
  /** Optional image attachments. */
  images?: { url: string }[];
  /** Stream setting passthrough; not used at agent construction. */
  systemPromptSuffix?: string;
}

/**
 * Build a runnable Agent from an AgentDefinition row, suitable for AiPanel
 * chat invocations. Handles the seven user-facing built-in kinds (spark,
 * scene, reader, editor, character-dialogue, brainstorm, chat) AND
 * `kind="user"` rows uniformly — all of them are just "system prompt + tool
 * subset + optional model override".
 *
 * For built-in pipeline kinds (reader/editor/orchestrator/verifier), this
 * factory is used ONLY for chat-mode invocations. Pipeline runs use the
 * dedicated factories in `reader.ts` / `editor.ts` which build mode- and
 * work-unit-specific briefings; those factories read the same agent row's
 * `modelOverride` so per-agent model config flows to both paths.
 */
export function makeChatAgent(input: MakeChatAgentInput): Agent {
  const { definition, projectId, context } = input;
  const enableToolCalling = definition.allowedToolIds.length > 0;

  const baseSystemPrompt = definition.systemPrompt;
  const withSuffix = input.systemPromptSuffix
    ? `${baseSystemPrompt}\n\n${input.systemPromptSuffix}`
    : baseSystemPrompt;
  const systemPrompt = withScreenplaySuffix(withSuffix, context);

  return {
    id: `chat:${definition.kind}:${definition.id}`,
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
      images: input.images,
    }),
    agentContext: {
      projectId,
      agentKind: definition.kind === "user" ? "custom" : definition.kind,
    },
    systemPrompt,
  };
}
