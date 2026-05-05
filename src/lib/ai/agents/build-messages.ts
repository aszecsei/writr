import { buildAgenticContext, buildMessages } from "../prompts";
import type { AiContext, AiMessage, AiToolId, ContentPart } from "../types";
import type { BuildMessagesFn } from "./types";

const UNDERSTOOD_REPLY = "Understood.";

/**
 * Build a `buildMessages` function for the manual chat agent — the synthesized
 * agent the AiPanel uses to preserve its existing task-tool selector UX. This
 * delegates to the legacy `buildMessages()` so behavior is bit-identical.
 */
export function makeManualAgentBuildMessages(args: {
  tool: AiToolId;
  context: AiContext;
  enableToolCalling: boolean;
  postChatInstructions?: string;
  postChatInstructionsDepth?: number;
  assistantPrefill?: string;
  customSystemPrompt?: string | null;
  toolPromptOverride?: string;
  images?: { url: string }[];
}): BuildMessagesFn {
  return ({ history, userInput, skipUserPrompt }) =>
    buildMessages(args.tool, userInput ?? "", args.context, history, {
      postChatInstructions: args.postChatInstructions,
      postChatInstructionsDepth: args.postChatInstructionsDepth,
      assistantPrefill: args.assistantPrefill,
      customSystemPrompt: args.customSystemPrompt,
      toolPromptOverride: args.toolPromptOverride,
      images: args.images,
      enableToolCalling: args.enableToolCalling,
      skipUserPrompt,
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
   */
  initialMessages?: AiMessage[];
  /** Whether to mark the last history message with cache_control. */
  enableToolCalling?: boolean;
  /** Optional assistant prefill appended at the end. */
  assistantPrefill?: string;
}

/**
 * Build a `buildMessages` function for proper pipeline agents. Skips the
 * legacy task-tool resolution — `systemPrompt` is used verbatim. Reuses the
 * cacheable agentic-context block so prompt caching benefits carry over.
 */
export function makeAgentBuildMessages(
  args: AgentBuildMessagesArgs,
): BuildMessagesFn {
  return ({ history, userInput, skipUserPrompt }) =>
    assembleAgentMessages(args, history, userInput, skipUserPrompt);
}

function assembleAgentMessages(
  args: AgentBuildMessagesArgs,
  history: AiMessage[],
  userInput: string | undefined,
  skipUserPrompt: boolean | undefined,
): AiMessage[] {
  const messages: AiMessage[] = [
    { role: "system", content: args.systemPrompt },
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
  messages.push({ role: "assistant", content: UNDERSTOOD_REPLY });

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

  if (!skipUserPrompt && userInput !== undefined && userInput.length > 0) {
    messages.push({ role: "user", content: userInput });
  }

  if (args.assistantPrefill) {
    messages.push({ role: "assistant", content: args.assistantPrefill });
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
