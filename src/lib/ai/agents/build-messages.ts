import { buildAgenticContext, buildMessages } from "../prompts";
import type { AiContext, AiMessage, ContentPart } from "../types";
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
 * Wraps `prompts.ts/buildMessages` so chat agents share the same prompt
 * assembly as the legacy task-tool flow once did — full bible context,
 * <chapter> injection when an active chapter is set, post-chat instructions,
 * etc. — but reads its system content from the agent definition row. The
 * user message (with `<selected-text>` and image attachments) arrives in
 * `history` already wire-formatted via `toAiMessages`.
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

interface AgentBuildMessagesArgs {
  /** Pre-rendered system content, used verbatim. */
  systemPrompt: string;
  /** Cacheable project context (style guide etc.) injected after system. */
  context: AiContext;
  /**
   * Optional priming messages inserted between context and history (e.g. a
   * pass-summary user message + assistant ack on Reader iteration 2+).
   * Pipeline agents that want a "go" prompt place it here instead of using a
   * separate userInput parameter.
   */
  initialMessages?: AiMessage[];
  /** Whether to mark the last history message with cache_control. */
  enableToolCalling?: boolean;
  /** Optional assistant prefill appended at the end. */
  assistantPrefill?: string;
}

/**
 * Build a `buildMessages` function for pipeline agents. Uses a minimal
 * cacheable context block (project metadata + style guide only) — pipeline
 * agents fetch deeper data on demand via tools.
 */
export function makeAgentBuildMessages(
  args: AgentBuildMessagesArgs,
): BuildMessagesFn {
  return ({ history }) => assembleAgentMessages(args, history);
}

function assembleAgentMessages(
  args: AgentBuildMessagesArgs,
  history: AiMessage[],
): AiMessage[] {
  // The Anthropic API caps total cache_control breakpoints per request at 4.
  // We currently use four: (1) system prompt, (2) project context user
  // message, (3) last tool entry (set by the adapter), (4) trailing history
  // message (set by withTrailingCacheControl when enableToolCalling). Adding
  // any more breakpoints will silently drop the oldest.
  const messages: AiMessage[] = [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: args.systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
    },
  ];

  // Cacheable project context (small — style guide + metadata only).
  const contextXml = buildAgenticContext(args.context);
  messages.push({
    role: "user",
    content: [
      {
        type: "text",
        text: contextXml,
        cache_control: { type: "ephemeral" },
      },
    ],
  });

  if (args.initialMessages) {
    messages.push(...args.initialMessages);
  }

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    const isLast = i === history.length - 1;

    let content = msg.content;
    if (args.enableToolCalling && isLast && history.length > 0) {
      content = withTrailingCacheControl(content);
    }

    messages.push({
      role: msg.role,
      content,
      ...(msg.toolCalls ? { toolCalls: msg.toolCalls } : {}),
      ...(msg.toolCallId ? { toolCallId: msg.toolCallId } : {}),
    });
  }

  if (args.assistantPrefill) {
    messages.push({ role: "assistant", content: args.assistantPrefill });
    return messages;
  }

  // Anthropic via OpenRouter (Azure-routed) rejects messages that end with
  // role:"assistant". Pipeline agents are invoked with no userInput on the
  // first iteration; without this guard, a stray assistant message in
  // initialMessages or history would trip Azure's prefill restriction.
  while (
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant"
  ) {
    messages.pop();
  }

  return messages;
}

function withTrailingCacheControl(
  content: string | ContentPart[],
): string | ContentPart[] {
  if (typeof content === "string") {
    return [
      {
        type: "text",
        text: content,
        cache_control: { type: "ephemeral" },
      },
    ];
  }
  const parts = [...content];
  for (let j = parts.length - 1; j >= 0; j--) {
    if (parts[j].type === "text") {
      parts[j] = { ...parts[j], cache_control: { type: "ephemeral" } };
      break;
    }
  }
  return parts;
}
