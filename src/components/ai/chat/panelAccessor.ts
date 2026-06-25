"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { ChatHistoryAccessor } from "@/lib/ai/agents/accessor";
import type { AiMessage } from "@/lib/ai/types";
import {
  type AccessorView,
  makeChatAccessorCore,
  type ToolApprovalInfo,
} from "./accessorCore";
import { toAiMessages } from "./toAiMessages";
import type {
  AssistantChatMessage,
  ChatMessage,
  ChatMessageId,
  ToolChatMessage,
} from "./types";

/** View that reads/writes the root `messages` array via `setMessages`. */
function rootView(
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
): AccessorView {
  return {
    append(drafts) {
      setMessages((prev) => [...prev, ...drafts]);
    },
    patch(id, patch) {
      setMessages((prev) => prev.map((m) => (m.id === id ? patch(m) : m)));
    },
    remove(id) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    },
  };
}

/**
 * View that reads/writes the `nestedMessages` array of a parent delegate tool
 * message. Used by sub-agent runs so their transcript renders nested under the
 * delegate call the user can drill into.
 */
function nestedView(
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
  parentToolMessageId: ChatMessageId,
): AccessorView {
  function mapParent(
    messages: ChatMessage[],
    updater: (nested: ChatMessage[]) => ChatMessage[],
  ): ChatMessage[] {
    return messages.map((m) => {
      if (m.role !== "tool" || m.id !== parentToolMessageId) return m;
      const tool = m as ToolChatMessage;
      return { ...tool, nestedMessages: updater(tool.nestedMessages ?? []) };
    });
  }
  return {
    append(drafts) {
      setMessages((prev) =>
        mapParent(prev, (nested) => [...nested, ...drafts]),
      );
    },
    patch(id, patch) {
      setMessages((prev) =>
        mapParent(prev, (nested) =>
          nested.map((m) => (m.id === id ? patch(m) : m)),
        ),
      );
    },
    remove(id) {
      setMessages((prev) =>
        mapParent(prev, (nested) => nested.filter((m) => m.id !== id)),
      );
    },
  };
}

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
   * Panel behavior overlay (Beta Reader). When `isPanel` is true,
   * `finalizeAssistantTurn` marks the assistant message so MessageList
   * routes its content through BetaReaderPanelMessage.
   */
  panel?: {
    isPanel: boolean;
  };
  /**
   * Approval gate for tools that require human confirmation. The chat panel
   * resolves the returned promise via Approve/Deny click handlers.
   */
  awaitToolApproval: (toolMessageId: ChatMessageId) => Promise<boolean>;
}

/**
 * Build a `ChatHistoryAccessor` keyed off the AiPanel's `setMessages` state
 * setter, seeded from `messagesRef.current`. Thin wrapper over
 * `makeChatAccessorCore` providing the root view + Spark/Panel finalize
 * overlay.
 */
export function makeAiPanelAccessor(
  opts: MakeAiPanelAccessorOptions,
): ChatHistoryAccessor {
  const { messagesRef, setMessages, spark, panel, awaitToolApproval } = opts;

  return makeChatAccessorCore({
    initialBuffer: toAiMessages(messagesRef.current),
    view: rootView(setMessages),
    awaitToolApproval,
    finalizeOverlay: (m: AssistantChatMessage) => ({
      ...m,
      sparkOptions: spark?.isSpark ? true : m.sparkOptions,
      sparkCapturedRange: spark?.isSpark
        ? spark.capturedRange
        : m.sparkCapturedRange,
      panelOutput: panel?.isPanel ? true : m.panelOutput,
    }),
  });
}

interface MakeNestedPanelAccessorOptions {
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  /** The delegate tool message under which the sub-agent transcript renders. */
  parentToolMessageId: ChatMessageId;
  /** The delegate prompt; seeds the sub-agent's wire-format history. */
  seedPrompt: string;
  /**
   * Approval gate for the sub-agent's mutating tools. Bubbled to the top-level
   * panel (read-only sub-agent tools have `requiresApproval: false` and never
   * call this).
   */
  awaitToolApproval: (
    toolMessageId: ChatMessageId,
    info?: ToolApprovalInfo,
  ) => Promise<boolean>;
}

/**
 * Build a `ChatHistoryAccessor` for a delegated sub-agent run. A true peer of
 * the root accessor: its own buffer (seeded with just the delegate prompt) and
 * its own pending maps; only the write target differs — drafts land in the
 * parent delegate tool message's `nestedMessages`.
 */
export function makeNestedPanelAccessor(
  opts: MakeNestedPanelAccessorOptions,
): ChatHistoryAccessor {
  const { setMessages, parentToolMessageId, seedPrompt, awaitToolApproval } =
    opts;

  const initialBuffer: AiMessage[] = [{ role: "user", content: seedPrompt }];

  return makeChatAccessorCore({
    initialBuffer,
    view: nestedView(setMessages, parentToolMessageId),
    awaitToolApproval,
  });
}
