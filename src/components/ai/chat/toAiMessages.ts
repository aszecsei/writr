import { match } from "ts-pattern";
import { isTerminalToolStatus } from "@/lib/ai/tool-calling";
import type { AiMessage } from "@/lib/ai/types";
import { escapeAttr } from "@/lib/ai/xml";
import type {
  AssistantChatMessage,
  ChatMessage,
  ToolChatMessage,
  UserChatMessage,
} from "./types";

/**
 * Wrap the user's typed prompt into the wire-format user message. Lifts:
 *   - `<selected-text>` wrapping when the editor selection was captured
 *   - image attachments composed as a multi-part content array
 *
 * The single conversion site from the canonical ChatMessage history to the
 * wire format.
 */
function userToAiMessage(m: UserChatMessage): AiMessage {
  const selectionTag = m.selectedChapterId
    ? `<selected-text chapter-id="${escapeAttr(m.selectedChapterId)}">`
    : "<selected-text>";
  const text = m.selectedText
    ? `${selectionTag}\n${m.selectedText}\n</selected-text>\n\n${m.content}`
    : m.content;
  const images = m.images;
  if (!images || images.length === 0) {
    return { role: "user", content: text };
  }

  return {
    role: "user",
    content: [
      { type: "text", text },
      ...images.map((img) => ({
        type: "image_url" as const,
        image_url: { url: img.url },
      })),
    ],
  };
}

function assistantToAiMessage(m: AssistantChatMessage): AiMessage {
  const out: AiMessage = { role: "assistant", content: m.content };
  if (m.toolCallRefs?.length) {
    out.toolCalls = m.toolCallRefs;
  }
  return out;
}

/**
 * Convert a finalized ToolChatMessage into the wire-format role:"tool" row.
 * Returns `null` for tool messages that haven't reached a terminal status —
 * those should be filtered out of the API request because the model only
 * cares about results that exist.
 */
function toolToAiMessage(m: ToolChatMessage): AiMessage | null {
  if (!isTerminalToolStatus(m.status)) return null;
  const content =
    m.status === "denied"
      ? JSON.stringify({ success: false, message: "Denied by user" })
      : JSON.stringify(m.result ?? { success: false, message: "No result" });
  return { role: "tool", content, toolCallId: m.toolCallId };
}

/**
 * Convert the canonical `ChatMessage[]` history to the wire-format
 * `AiMessage[]` array sent to the model.
 *
 * Pending/approved tool messages are dropped from the wire format because
 * they have no result to send yet — they only exist in the chat history to
 * drive the approval UI. After conversion, a self-validating pass repairs
 * any orphan `tool_use` ids — see `repairOrphanToolCalls`.
 */
export function toAiMessages(history: readonly ChatMessage[]): AiMessage[] {
  const out: AiMessage[] = [];
  for (const m of history) {
    match(m)
      .with({ role: "user" }, (msg) => {
        out.push(userToAiMessage(msg));
      })
      .with({ role: "assistant" }, (msg) => {
        out.push(assistantToAiMessage(msg));
      })
      .with({ role: "tool" }, (msg) => {
        const wire = toolToAiMessage(msg);
        if (wire) out.push(wire);
      })
      .exhaustive();
  }
  return repairOrphanToolCalls(out);
}

/**
 * Walk the wire-format messages and ensure every assistant `toolCalls[i].id`
 * has a matching `role: "tool"` row with the same `toolCallId` immediately
 * following the assistant (interrupted only by other tool rows). For any
 * orphan id, synthesize a failure tool_result so the upstream protocol
 * (Anthropic / Bedrock) accepts the request.
 *
 * This is defensive: the runner is supposed to keep these in sync, but
 * abort paths and edge cases can leave a tool message non-terminal — and
 * the conversion above silently drops non-terminal tools, leaving the
 * assistant's id without a partner. Without this repair, OpenRouter/Bedrock
 * rejects the entire conversation with `tool_use ids were found without
 * tool_result blocks immediately after`.
 */
function repairOrphanToolCalls(messages: AiMessage[]): AiMessage[] {
  const out: AiMessage[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    out.push(msg);
    if (msg.role !== "assistant" || !msg.toolCalls?.length) continue;

    // Walk forward over the consecutive tool_result rows that follow this
    // assistant, copying them through and tracking which ids are present.
    const seen = new Set<string>();
    let j = i + 1;
    while (j < messages.length && messages[j].role === "tool") {
      const toolMsg = messages[j];
      out.push(toolMsg);
      if (toolMsg.toolCallId) seen.add(toolMsg.toolCallId);
      j += 1;
    }
    i = j - 1; // outer loop's `i++` advances past the tool rows we just copied

    // Synthesize a failure row for any toolCalls id without a partner. The
    // upstream Anthropic protocol requires every tool_use to be paired with
    // a tool_result in the very next user message — without this, Bedrock
    // rejects the conversation with `tool_use ids were found without
    // tool_result blocks immediately after`.
    for (const call of msg.toolCalls) {
      if (seen.has(call.id)) continue;
      console.warn(
        `[toAiMessages] synthesizing missing tool_result for ${call.id} (${call.name})`,
      );
      out.push({
        role: "tool",
        content: JSON.stringify({
          success: false,
          message: "Tool result missing",
        }),
        toolCallId: call.id,
      });
    }
  }
  return out;
}
