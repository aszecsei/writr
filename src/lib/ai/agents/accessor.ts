import type { ToolCallEntry } from "../tool-calling";
import type {
  AiMessage,
  AiStreamChunk,
  AiToolCall,
  AiUsage,
  FinishReason,
} from "../types";

/**
 * Opaque message id returned by `startAssistantTurn` /
 * `appendPendingToolMessage`. The runner doesn't introspect it — it only
 * passes it back to the accessor on subsequent calls. Implementations may
 * brand it (e.g. chat panel uses `ChatMessageId`).
 */
export type AccessorMessageId = string;

export interface AssistantTurnFinalizeInfo {
  durationMs: number;
  finishReason?: FinishReason;
  usage?: AiUsage;
  /** Tool-call references the assistant emitted, if any. */
  toolCallRefs?: AiToolCall[];
}

export interface ToolMessagePatch {
  status?: ToolCallEntry["status"];
  result?: ToolCallEntry["result"];
}

/**
 * Interface the agent runner uses to read and write the canonical chat
 * history. `AiPanel` builds one keyed off `setMessages` to drive the UI; a
 * delegated sub-agent builds a nested variant so its transcript renders under
 * the parent's delegate call. The runner never branches on caller type.
 */
export interface ChatHistoryAccessor {
  /**
   * Snapshot of the wire-format history at the moment of call. Read by the
   * runner before each iteration to assemble the API request body.
   */
  getMessages(): AiMessage[];

  /**
   * Begin a new assistant turn. Returns a stable id the runner uses on
   * subsequent chunk/finalize calls. `iteration` is 1-based.
   * `capturedPrompt` is set on iteration 1 only (for the prompt-inspector UI).
   */
  startAssistantTurn(opts: {
    iteration: number;
    capturedPrompt?: AiMessage[];
  }): AccessorMessageId;

  /**
   * Forward a streaming chunk into the in-progress assistant turn.
   * Implementations accumulate `content` / `reasoning` text on the message.
   * `tool_use` and `stop` chunks are not forwarded — the runner batches
   * tool-call refs into `finalizeAssistantTurn.toolCallRefs` and consumes
   * the `stop` chunk for finishReason/usage accounting.
   */
  appendChunk(id: AccessorMessageId, chunk: AiStreamChunk): void;

  /**
   * Append all pending tool messages for one assistant turn in a single
   * batch. Each `entry.status` is "pending" (awaiting human approval) or
   * "approved" (auto-run). Returns one accessor message id per entry, in
   * the same order, for subsequent `updateToolMessage` and `approveToolCall`
   * calls. Batching matches the wire-format expectation that all tool_use
   * ids in an assistant turn are followed by their tool result rows in
   * order.
   */
  appendPendingToolMessages(
    assistantId: AccessorMessageId,
    entries: ToolCallEntry[],
  ): AccessorMessageId[];

  /**
   * Update a tool message's status/result as it progresses through approval
   * and execution.
   */
  updateToolMessage(
    toolMessageId: AccessorMessageId,
    patch: ToolMessagePatch,
  ): void;

  /**
   * Mark the assistant turn complete. Implementations persist the duration
   * and finishReason.
   */
  finalizeAssistantTurn(
    id: AccessorMessageId,
    info: AssistantTurnFinalizeInfo,
  ): void;

  /**
   * Drop an in-progress assistant turn. Used on abort to clean up the
   * incomplete message before unwinding.
   */
  removeAssistantTurn(id: AccessorMessageId): void;

  /**
   * Optional gate for tool calls whose definition has `requiresApproval:
   * true`. The chat UI presents Approve/Deny buttons; when unset, the runner
   * auto-approves.
   */
  approveToolCall?: (toolMessageId: AccessorMessageId) => Promise<boolean>;
}
