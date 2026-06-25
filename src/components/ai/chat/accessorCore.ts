"use client";

import type {
  AccessorMessageId,
  AssistantTurnFinalizeInfo,
  ChatHistoryAccessor,
  ToolMessagePatch,
} from "@/lib/ai/agents/accessor";
import type { ToolCallEntry } from "@/lib/ai/tool-calling";
import type { AiMessage, AiToolCall } from "@/lib/ai/types";
import {
  makeEmptyAssistantMessage,
  makePendingToolMessage,
  toToolCallRef,
} from "./factories";
import type { AssistantChatMessage, ChatMessage, ChatMessageId } from "./types";

/**
 * Abstraction over WHERE chat messages are written. The top-level panel
 * accessor writes to the root `messages` array; the nested (sub-agent)
 * accessor writes into a parent delegate tool message's `nestedMessages`.
 * Both share the buffer-commit logic in `makeChatAccessorCore`.
 */
export interface AccessorView {
  /** Append draft messages to the view in order. */
  append(drafts: ChatMessage[]): void;
  /** Replace the message with `id`, applying `patch` (called only for that id). */
  patch(id: ChatMessageId, patch: (m: ChatMessage) => ChatMessage): void;
  /** Remove the message with `id`. */
  remove(id: ChatMessageId): void;
}

/** Minimal descriptor of a pending tool call, for the approval gate. */
export interface ToolApprovalInfo {
  toolName: string;
  displayName: string;
  input: Record<string, unknown>;
}

interface MakeChatAccessorCoreOptions {
  /** Wire-format history the buffer starts from. */
  initialBuffer: AiMessage[];
  /** Where rendered messages go. */
  view: AccessorView;
  /**
   * Approval gate for tools whose definition has `requiresApproval: true`. The
   * second argument carries the pending tool's descriptor so callers can label
   * a bubbled-up approval prompt. Omit to auto-approve.
   */
  awaitToolApproval?: (
    toolMessageId: ChatMessageId,
    info?: ToolApprovalInfo,
  ) => Promise<boolean>;
  /**
   * Optional finalize overlay (e.g. Spark / Beta Reader marks). Applied to the
   * finalized assistant message before it's written to the view.
   */
  finalizeOverlay?: (m: AssistantChatMessage) => AssistantChatMessage;
}

interface PendingAssistantTurn {
  content: string;
  toolMessages: PendingToolMessage[];
}

interface PendingToolMessage {
  toolMsgId: AccessorMessageId;
  entry: ToolCallEntry;
}

/**
 * Shared `ChatHistoryAccessor` implementation. Maintains its own canonical
 * `AiMessage[]` buffer (the wire format the runner sends to the model) and
 * mirrors UI drafts through the injected `view`. Assistant turns and tool rows
 * commit to the buffer on finalize / terminal status only, so in-progress
 * drafts never leak into a request and orphan a `tool_use` id.
 *
 * The top-level panel and each nested sub-agent run get their own instance
 * with their own buffer and `view` — they are peers, never sharing buffer
 * state, which preserves the per-`runAgent` paired tool_use/tool_result
 * invariant that `repairOrphanToolCalls` relies on.
 */
export function makeChatAccessorCore(
  opts: MakeChatAccessorCoreOptions,
): ChatHistoryAccessor {
  const { view, awaitToolApproval, finalizeOverlay } = opts;
  const buffer: AiMessage[] = opts.initialBuffer;

  const pending = new Map<AccessorMessageId, PendingAssistantTurn>();
  const toolToAssistant = new Map<AccessorMessageId, AccessorMessageId>();

  function lookupToolInfo(
    toolMessageId: AccessorMessageId,
  ): ToolApprovalInfo | undefined {
    const assistantId = toolToAssistant.get(toolMessageId);
    const turn = assistantId ? pending.get(assistantId) : undefined;
    const tool = turn?.toolMessages.find((t) => t.toolMsgId === toolMessageId);
    if (!tool) return undefined;
    return {
      toolName: tool.entry.toolName,
      displayName: tool.entry.displayName,
      input: tool.entry.input,
    };
  }

  return {
    getMessages(): AiMessage[] {
      return buffer;
    },

    startAssistantTurn({ capturedPrompt }) {
      const draft = makeEmptyAssistantMessage({ capturedPrompt });
      const id = draft.id as AccessorMessageId;
      pending.set(id, { content: "", toolMessages: [] });
      view.append([draft]);
      return id;
    },

    appendChunk(id, chunk) {
      if (chunk.type !== "content" && chunk.type !== "reasoning") return;
      const turn = pending.get(id);
      if (turn && chunk.type === "content") {
        turn.content += chunk.text;
      }
      view.patch(id as ChatMessageId, (m) => {
        if (m.role !== "assistant") return m;
        if (chunk.type === "reasoning") {
          return { ...m, reasoning: (m.reasoning ?? "") + chunk.text };
        }
        return { ...m, content: m.content + chunk.text };
      });
    },

    appendPendingToolMessages(assistantId, entries: ToolCallEntry[]) {
      const turn = pending.get(assistantId);
      const drafts = entries.map((entry) =>
        makePendingToolMessage({
          toolCallId: entry.id,
          toolName: entry.toolName,
          displayName: entry.displayName,
          toolInput: entry.input,
          status: entry.status,
        }),
      );
      const toolMsgIds = drafts.map((d) => d.id as AccessorMessageId);
      if (turn) {
        for (let i = 0; i < entries.length; i++) {
          turn.toolMessages.push({
            toolMsgId: toolMsgIds[i],
            entry: { ...entries[i] },
          });
          toolToAssistant.set(toolMsgIds[i], assistantId);
        }
      }
      view.append(drafts);
      return toolMsgIds;
    },

    updateToolMessage(toolMessageId, patch: ToolMessagePatch) {
      const assistantId = toolToAssistant.get(toolMessageId);
      const turn = assistantId ? pending.get(assistantId) : undefined;
      const tool = turn?.toolMessages.find(
        (t) => t.toolMsgId === toolMessageId,
      );

      const wasTerminal =
        tool?.entry.status === "executed" ||
        tool?.entry.status === "denied" ||
        tool?.entry.status === "error";

      if (tool) {
        if (patch.status !== undefined) tool.entry.status = patch.status;
        if (patch.result !== undefined) tool.entry.result = patch.result;
      }

      const isTerminal =
        tool?.entry.status === "executed" ||
        tool?.entry.status === "denied" ||
        tool?.entry.status === "error";

      // Commit the role:"tool" row to the buffer the first time this entry
      // reaches a terminal status. Order matches dispatch order so tool_use
      // ids in an assistant turn are followed by their results in the wire
      // format.
      if (tool && isTerminal && !wasTerminal) {
        const content =
          tool.entry.status === "denied"
            ? JSON.stringify({ success: false, message: "Denied by user" })
            : JSON.stringify(
                tool.entry.result ?? {
                  success: false,
                  message: "No result",
                },
              );
        buffer.push({
          role: "tool",
          content,
          toolCallId: tool.entry.id,
        });
      }

      view.patch(toolMessageId as ChatMessageId, (m) => {
        if (m.role !== "tool") return m;
        return {
          ...m,
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.result !== undefined ? { result: patch.result } : {}),
        };
      });
    },

    finalizeAssistantTurn(id, info: AssistantTurnFinalizeInfo) {
      const turn = pending.get(id);
      if (turn) {
        const toolCalls: AiToolCall[] | undefined = info.toolCallRefs?.length
          ? info.toolCallRefs.map((r) => ({
              id: r.id,
              name: r.name,
              arguments: r.arguments,
            }))
          : undefined;
        buffer.push({
          role: "assistant",
          content: turn.content,
          ...(toolCalls ? { toolCalls } : {}),
        });
      }

      view.patch(id as ChatMessageId, (m): ChatMessage => {
        if (m.role !== "assistant") return m;
        let finalized: AssistantChatMessage = {
          ...m,
          durationMs: info.durationMs,
          finishReason: info.finishReason,
          toolCallRefs: info.toolCallRefs?.map(toToolCallRef),
        };
        if (finalizeOverlay) finalized = finalizeOverlay(finalized);
        return finalized;
      });
    },

    removeAssistantTurn(id) {
      const turn = pending.get(id);
      if (turn) {
        for (const tm of turn.toolMessages) {
          toolToAssistant.delete(tm.toolMsgId);
        }
        pending.delete(id);
      }
      view.remove(id as ChatMessageId);
    },

    approveToolCall: awaitToolApproval
      ? (toolMessageId) =>
          awaitToolApproval(
            toolMessageId as ChatMessageId,
            lookupToolInfo(toolMessageId),
          )
      : undefined,
  };
}
