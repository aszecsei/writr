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

    // Normalize ALL history content to ContentPart[] form when tool-calling
    // is enabled, so the wire shape stays byte-stable across iterations. Then
    // mark only the last message's last text part with cache_control. If we
    // only wrapped on `isLast`, the previously-trailing message would flip
    // from array form (iter N) to string form (iter N+1), busting Anthropic's
    // prefix-byte match between iterations.
    let content = msg.content;
    if (args.enableToolCalling) {
      content = toContentParts(content);
      if (isLast && history.length > 0) {
        content = withTrailingCacheControl(content);
      }
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

/**
 * Normalize a message content to ContentPart[] form. Wraps a bare string into
 * a single text block; passes a content array through unchanged (a fresh copy
 * so callers can mutate without aliasing).
 */
function toContentParts(content: string | ContentPart[]): ContentPart[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  return [...content];
}

/**
 * Mark the last text part of a content array with `cache_control` — the
 * breakpoint Anthropic uses to anchor the conversation-prefix cache across
 * tool-calling iterations.
 */
function withTrailingCacheControl(parts: ContentPart[]): ContentPart[] {
  const out = [...parts];
  for (let j = out.length - 1; j >= 0; j--) {
    if (out[j].type === "text") {
      out[j] = { ...out[j], cache_control: { type: "ephemeral" } };
      break;
    }
  }
  return out;
}
