import { buildMessages } from "../prompts";
import type { AiContext } from "../types";
import type { BuildMessagesFn } from "./types";

export interface ChatAgentBuildMessagesArgs {
  /** Pre-resolved system prompt taken from the AgentDefinition row. */
  systemPrompt: string;
  /** Full project context (story bible). */
  context: AiContext;
  enableToolCalling?: boolean;
  /** Forwarded to buildMessages. */
  postChatInstructions?: string;
  postChatInstructionsDepth?: number;
  assistantPrefill?: string;
  customSystemPrompt?: string | null;
}

/**
 * Build a `buildMessages` function for chat-mode agents (the AiPanel flow).
 * Wraps `prompts.ts/buildMessages` — full bible context, <chapter> injection
 * when an active chapter is set, post-chat instructions, etc. — reading its
 * system content from the agent definition row. The user message (with
 * `<selected-text>` and image attachments) arrives in `history` already
 * wire-formatted via `toAiMessages`.
 */
export function makeChatAgentBuildMessages(
  args: ChatAgentBuildMessagesArgs,
): BuildMessagesFn {
  return ({ history }) =>
    buildMessages(args.systemPrompt, args.context, history, {
      postChatInstructions: args.postChatInstructions,
      postChatInstructionsDepth: args.postChatInstructionsDepth,
      assistantPrefill: args.assistantPrefill,
      customSystemPrompt: args.customSystemPrompt,
      enableToolCalling: args.enableToolCalling ?? false,
    });
}
