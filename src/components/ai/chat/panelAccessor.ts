"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  AccessorMessageId,
  AssistantTurnFinalizeInfo,
  ChatHistoryAccessor,
  ToolMessagePatch,
} from "@/lib/ai/agents/accessor";
import type { ToolCallEntry } from "@/lib/ai/tool-calling";
import type { AiMessage } from "@/lib/ai/types";
import {
  makeEmptyAssistantMessage,
  makePendingToolMessage,
  toToolCallRef,
} from "./factories";
import { toAiMessages } from "./toAiMessages";
import type { AssistantChatMessage, ChatMessage, ChatMessageId } from "./types";

interface MakeAiPanelAccessorOptions {
  /**
   * Stable ref to the latest `messages` state. Used by `getMessages()` so
   * the runner always reads the freshest snapshot regardless of the React
   * batching window.
   */
  messagesRef: MutableRefObject<ChatMessage[]>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  /**
   * Spark behavior overlay. When `isSpark` is true, `finalizeAssistantTurn`
   * marks the assistant message as a Spark options carrier and tags it with
   * the editor selection captured at submit time so the option renderer can
   * replace the user's highlighted range.
   */
  spark?: {
    isSpark: boolean;
    capturedRange: { from: number; to: number } | null;
  };
  /**
   * Approval gate for tools that require human confirmation. The chat panel
   * resolves the returned promise via Approve/Deny click handlers.
   */
  awaitToolApproval: (toolMessageId: ChatMessageId) => Promise<boolean>;
}

/**
 * Build a `ChatHistoryAccessor` keyed off the AiPanel's `setMessages` state
 * setter. Replaces the prior six-callback bag (`onIterationStart`,
 * `onChunk`, `onIterationEnd`, `onToolCallsCollected`, `onToolCallUpdate`,
 * `approveToolCall`) with one object whose methods each map to a single
 * `setMessages` call.
 */
export function makeAiPanelAccessor(
  opts: MakeAiPanelAccessorOptions,
): ChatHistoryAccessor {
  const { messagesRef, setMessages, spark, awaitToolApproval } = opts;

  return {
    getMessages(): AiMessage[] {
      return toAiMessages(messagesRef.current);
    },

    startAssistantTurn({ capturedPrompt }) {
      const draft = makeEmptyAssistantMessage({ capturedPrompt });
      setMessages((prev) => [...prev, draft]);
      return draft.id as AccessorMessageId;
    },

    appendChunk(id, chunk) {
      if (chunk.type !== "content" && chunk.type !== "reasoning") return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id || m.role !== "assistant") return m;
          if (chunk.type === "reasoning") {
            return { ...m, reasoning: (m.reasoning ?? "") + chunk.text };
          }
          return { ...m, content: m.content + chunk.text };
        }),
      );
    },

    appendPendingToolMessages(_assistantId, entries: ToolCallEntry[]) {
      const drafts = entries.map((entry) =>
        makePendingToolMessage({
          toolCallId: entry.id,
          toolName: entry.toolName,
          displayName: entry.displayName,
          toolInput: entry.input,
          status: entry.status,
        }),
      );
      setMessages((prev) => [...prev, ...drafts]);
      return drafts.map((d) => d.id as AccessorMessageId);
    },

    updateToolMessage(toolMessageId, patch: ToolMessagePatch) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== toolMessageId || m.role !== "tool") return m;
          return {
            ...m,
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.result !== undefined ? { result: patch.result } : {}),
          };
        }),
      );
    },

    finalizeAssistantTurn(id, info: AssistantTurnFinalizeInfo) {
      setMessages((prev) =>
        prev.map((m): ChatMessage => {
          if (m.id !== id || m.role !== "assistant") return m;
          const finalized: AssistantChatMessage = {
            ...m,
            durationMs: info.durationMs,
            finishReason: info.finishReason,
            toolCallRefs: info.toolCallRefs?.map(toToolCallRef),
            // Spark overlay: only applies if the active agent is Spark.
            sparkOptions: spark?.isSpark ? true : m.sparkOptions,
            sparkCapturedRange: spark?.isSpark
              ? spark.capturedRange
              : m.sparkCapturedRange,
          };
          return finalized;
        }),
      );
    },

    removeAssistantTurn(id) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    },

    approveToolCall: (toolMessageId) =>
      awaitToolApproval(toolMessageId as ChatMessageId),
  };
}
