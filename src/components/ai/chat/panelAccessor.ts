"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
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
import { toAiMessages } from "./toAiMessages";
import type { AssistantChatMessage, ChatMessage, ChatMessageId } from "./types";

interface MakeAiPanelAccessorOptions {
  /**
   * Stable ref to the latest `messages` state. Read once at accessor creation
   * to seed the canonical buffer. After that, the buffer is the source of
   * truth for the wire format — the ref is no longer consulted.
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

interface PendingAssistantTurn {
  content: string;
  toolMessages: PendingToolMessage[];
}

interface PendingToolMessage {
  toolMsgId: AccessorMessageId;
  entry: ToolCallEntry;
}

/**
 * Build a `ChatHistoryAccessor` keyed off the AiPanel's `setMessages` state
 * setter. The accessor maintains its own canonical `AiMessage[]` buffer
 * (seeded from `messagesRef.current` at construction) so `getMessages()` is
 * race-free with React's render schedule. React state is mutated in parallel
 * for UI rendering only — the buffer is what the runner sends to the model.
 *
 * Mirrors `pipeline/historyAccessor.ts` so both call sites use the same
 * commit-on-finalize pattern: assistant turns land in the buffer when
 * `finalizeAssistantTurn` runs (carrying their `toolCalls`), and tool rows
 * land when `updateToolMessage` flips a tool entry to a terminal status.
 * In-progress drafts never reach the buffer, so they can never leak into the
 * wire format and end the request with a stray `role: "assistant"`.
 */
export function makeAiPanelAccessor(
  opts: MakeAiPanelAccessorOptions,
): ChatHistoryAccessor {
  const { messagesRef, setMessages, spark, awaitToolApproval } = opts;

  // Seed the buffer from the chat history that exists at run start. This
  // includes prior turns the user has exchanged, repaired for any orphan
  // tool_use ids by `repairOrphanToolCalls` inside `toAiMessages`.
  const buffer: AiMessage[] = toAiMessages(messagesRef.current);

  const pending = new Map<AccessorMessageId, PendingAssistantTurn>();
  const toolToAssistant = new Map<AccessorMessageId, AccessorMessageId>();

  return {
    getMessages(): AiMessage[] {
      return buffer;
    },

    startAssistantTurn({ capturedPrompt }) {
      const draft = makeEmptyAssistantMessage({ capturedPrompt });
      const id = draft.id as AccessorMessageId;
      pending.set(id, { content: "", toolMessages: [] });
      setMessages((prev) => [...prev, draft]);
      return id;
    },

    appendChunk(id, chunk) {
      if (chunk.type !== "content" && chunk.type !== "reasoning") return;
      const turn = pending.get(id);
      if (turn && chunk.type === "content") {
        turn.content += chunk.text;
      }
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
      setMessages((prev) => [...prev, ...drafts]);
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
      // reaches a terminal status. Order matches dispatch order — the runner
      // walks tool entries sequentially — so tool_use ids in an assistant
      // turn are followed by their results in the wire format.
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
      // The in-progress turn was never committed to `buffer`, and any tool
      // messages it spawned are tracked in `pending` only — they were never
      // committed either (commits happen in `updateToolMessage` on terminal
      // status, but `removeAssistantTurn` is called on aborts before any
      // tool runs). Just clear the lookups.
      const turn = pending.get(id);
      if (turn) {
        for (const tm of turn.toolMessages) {
          toolToAssistant.delete(tm.toolMsgId);
        }
        pending.delete(id);
      }
      setMessages((prev) => prev.filter((m) => m.id !== id));
    },

    approveToolCall: (toolMessageId) =>
      awaitToolApproval(toolMessageId as ChatMessageId),
  };
}
