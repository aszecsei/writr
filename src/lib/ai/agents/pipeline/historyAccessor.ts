import { addTokenUsage, updateAgentRun } from "@/db/operations/agentRuns";
import type { AgentRunId } from "@/db/schemas";
import type { ToolCallEntry } from "../../tool-calling";
import type {
  AiMessage,
  AiStreamChunk,
  AiToolCall,
  AiUsage,
  FinishReason,
} from "../../types";
import type {
  AccessorMessageId,
  AccessorToolCallRef,
  AssistantTurnFinalizeInfo,
  ChatHistoryAccessor,
  ToolMessagePatch,
} from "../accessor";
import type { AgentEventOrigin, PipelineEventEmitter } from "./events";

interface PendingAssistantTurn {
  iteration: number;
  content: string;
  reasoning?: string;
  toolMessages: PendingToolMessage[];
  /** Stamped on `finalizeAssistantTurn` for token-accounting telemetry. */
  finalizeUsage?: AiUsage;
  finalizeFinishReason?: FinishReason;
  finalizeDurationMs?: number;
  /** Captured prompt for iteration-1 telemetry (mirrors the chat path). */
  capturedPrompt?: AiMessage[];
}

interface PendingToolMessage {
  toolMsgId: AccessorMessageId;
  entry: ToolCallEntry;
}

interface MakePipelineHistoryAccessorOptions {
  runId: AgentRunId;
  origin: AgentEventOrigin;
  initialHistory: AiMessage[];
  onEvent?: PipelineEventEmitter;
}

function generateId(): AccessorMessageId {
  return crypto.randomUUID();
}

/**
 * Pipeline-side ChatHistoryAccessor. Maintains an in-memory `AiMessage[]`
 * buffer that the runner reads on each iteration, and translates accessor
 * lifecycle calls into PipelineEvents (mirroring the legacy callback events
 * consumed by readerLoop / tierRunner / verifyTier and the activity store)
 * and AgentRun token-usage updates.
 *
 * Pipeline tools never `requiresApproval` in practice — we pass through with
 * `approveToolCall` returning `true`; the accessor still creates pending
 * tool messages so the events match the chat path.
 */
export function makePipelineHistoryAccessor(
  opts: MakePipelineHistoryAccessorOptions,
): ChatHistoryAccessor & { getMessages(): AiMessage[] } {
  const { runId, origin, initialHistory, onEvent } = opts;

  // The buffer is the canonical wire-format history. Finalized assistant
  // turns (with their toolCalls refs) and finalized tool results land here
  // in API-request order; the runner reads from `getMessages()` at the start
  // of each iteration.
  const buffer: AiMessage[] = [...initialHistory];

  const pending = new Map<AccessorMessageId, PendingAssistantTurn>();
  const toolToAssistant = new Map<AccessorMessageId, AccessorMessageId>();

  function emit(event: Parameters<PipelineEventEmitter>[0]): void {
    onEvent?.(event);
  }

  return {
    getMessages(): AiMessage[] {
      return buffer;
    },

    startAssistantTurn({ iteration, capturedPrompt }) {
      const id = generateId();
      pending.set(id, {
        iteration,
        content: "",
        toolMessages: [],
        capturedPrompt,
      });
      emit({
        type: "agent-iteration-start",
        runId,
        origin,
        info: { messageId: id, iteration, capturedPrompt },
      });
      return id;
    },

    appendChunk(id, chunk: AiStreamChunk) {
      const entry = pending.get(id);
      if (!entry) return;
      if (chunk.type === "content") entry.content += chunk.text;
      if (chunk.type === "reasoning") {
        entry.reasoning = (entry.reasoning ?? "") + chunk.text;
      }
      emit({
        type: "agent-chunk",
        runId,
        origin,
        messageId: id,
        chunk,
      });
    },

    appendPendingToolMessages(assistantId, entries: ToolCallEntry[]) {
      const turn = pending.get(assistantId);
      if (!turn) {
        // Defensive: caller violated lifecycle. Still issue ids so the
        // runner can complete its loop cleanly; the messages won't ship.
        return entries.map(() => generateId());
      }
      const toolMsgIds = entries.map(() => generateId());
      for (let i = 0; i < entries.length; i++) {
        turn.toolMessages.push({
          toolMsgId: toolMsgIds[i],
          entry: { ...entries[i] },
        });
        toolToAssistant.set(toolMsgIds[i], assistantId);
      }
      // One `agent-tool-calls` event per iteration, payload contains the
      // full batch — matches the prior `onToolCallsCollected` semantics
      // that the activity store and readerLoop telemetry rely on.
      emit({
        type: "agent-tool-calls",
        runId,
        origin,
        info: {
          messageId: assistantId,
          iteration: turn.iteration,
          entries: entries.map((e) => ({ ...e })),
        },
      });
      return toolMsgIds;
    },

    updateToolMessage(toolMsgId, patch: ToolMessagePatch) {
      const assistantId = toolToAssistant.get(toolMsgId);
      if (!assistantId) return;
      const turn = pending.get(assistantId);
      if (!turn) return;
      const tool = turn.toolMessages.find((t) => t.toolMsgId === toolMsgId);
      if (!tool) return;
      const wasTerminal =
        tool.entry.status === "executed" ||
        tool.entry.status === "denied" ||
        tool.entry.status === "error";
      if (patch.status !== undefined) tool.entry.status = patch.status;
      if (patch.result !== undefined) tool.entry.result = patch.result;

      const isTerminal =
        tool.entry.status === "executed" ||
        tool.entry.status === "denied" ||
        tool.entry.status === "error";
      if (isTerminal && !wasTerminal) {
        // Commit the role:"tool" row to the buffer so the next iteration's
        // `getMessages()` snapshot includes it. Order: pending tool messages
        // are processed sequentially by the runner, so commits happen in
        // dispatch order — matching the wire-format expectation that each
        // tool_use id is followed by its tool result.
        const content =
          tool.entry.status === "denied"
            ? JSON.stringify({ success: false, message: "Denied by user" })
            : JSON.stringify(
                tool.entry.result ?? { success: false, message: "No result" },
              );
        buffer.push({
          role: "tool",
          content,
          toolCallId: tool.entry.id,
        });
      }

      emit({
        type: "agent-tool-update",
        runId,
        origin,
        info: {
          messageId: assistantId,
          iteration: turn.iteration,
          entry: { ...tool.entry },
        },
      });
    },

    async finalizeAssistantTurn(id, info: AssistantTurnFinalizeInfo) {
      const turn = pending.get(id);
      if (!turn) return;
      turn.finalizeUsage = info.usage;
      turn.finalizeFinishReason = info.finishReason;
      turn.finalizeDurationMs = info.durationMs;

      // Commit the assistant message to the buffer.
      const toolCalls: AiToolCall[] | undefined = info.toolCallRefs?.length
        ? info.toolCallRefs.map((r: AccessorToolCallRef) => ({
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

      // Persist token usage onto the AgentRun row (replaces what
      // withTokenAccounting used to do for callback-style runs).
      if (info.usage) {
        await addTokenUsage(runId, {
          promptTokens: info.usage.prompt_tokens,
          completionTokens: info.usage.completion_tokens,
          cacheCreationTokens: info.usage.cache_creation_tokens ?? 0,
          cacheReadTokens: info.usage.cache_read_tokens ?? 0,
        });
        await updateAgentRun(runId, {
          lastIterationPromptTokens: info.usage.prompt_tokens,
        });
      }

      emit({
        type: "agent-iteration-end",
        runId,
        origin,
        info: {
          messageId: id,
          iteration: turn.iteration,
          content: turn.content,
          reasoning: turn.reasoning,
          finishReason: info.finishReason,
          durationMs: info.durationMs,
          usage: info.usage,
        },
      });
    },

    removeAssistantTurn(id) {
      const turn = pending.get(id);
      if (!turn) return;
      // Drop the in-progress turn — nothing to commit. Tool messages we
      // appended for this turn were never committed to the buffer either,
      // so just clear the lookup tables.
      for (const tm of turn.toolMessages) {
        toolToAssistant.delete(tm.toolMsgId);
      }
      pending.delete(id);
    },

    // Pipeline tools auto-approve — staging tables make tool runs reversible
    // without requiring human gating during the run itself.
    approveToolCall: async () => true,
  };
}
