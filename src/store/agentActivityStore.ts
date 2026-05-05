import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  AnyAgentKind,
  IterationEndInfo,
  IterationStartInfo,
} from "@/lib/ai/agents/types";
import type { ToolCallEntry } from "@/lib/ai/tool-calling/types";
import type { AiMessage, AiStreamChunk, FinishReason } from "@/lib/ai/types";

export interface ActivityIteration {
  /** Unique per `runAgent` iteration. Matches `IterationEndInfo.messageId`. */
  messageId: string;
  agentKind: AnyAgentKind;
  agentId: string;
  iteration: number;
  /** Wall-clock when the iteration began. Used for ordering parallel editors. */
  startedAt: number;
  /** Full prompt sent to the model. Captured on iteration 1 only. */
  capturedPrompt?: AiMessage[];
  reasoning: string;
  content: string;
  finishReason?: FinishReason;
  durationMs?: number;
  toolCalls: ToolCallEntry[];
  status: "streaming" | "complete";
}

interface AgentActivityState {
  /** Per-runId list of iterations, in arrival order. */
  runs: Record<string, ActivityIteration[]>;

  beginIteration: (
    runId: string,
    info: IterationStartInfo,
    agentKind: AnyAgentKind,
    agentId: string,
  ) => void;
  appendChunk: (runId: string, messageId: string, chunk: AiStreamChunk) => void;
  completeIteration: (runId: string, info: IterationEndInfo) => void;
  setToolCalls: (
    runId: string,
    messageId: string,
    entries: ToolCallEntry[],
  ) => void;
  updateToolCall: (
    runId: string,
    messageId: string,
    entry: ToolCallEntry,
  ) => void;
  clearRun: (runId: string) => void;
}

export const useAgentActivityStore = create<AgentActivityState>()(
  immer((set) => ({
    runs: {},

    beginIteration: (runId, info, agentKind, agentId) =>
      set((s) => {
        const list = s.runs[runId] ?? [];
        list.push({
          messageId: info.messageId,
          agentKind,
          agentId,
          iteration: info.iteration,
          startedAt: Date.now(),
          capturedPrompt: info.capturedPrompt,
          reasoning: "",
          content: "",
          toolCalls: [],
          status: "streaming",
        });
        s.runs[runId] = list;
      }),

    appendChunk: (runId, messageId, chunk) =>
      set((s) => {
        const list = s.runs[runId];
        if (!list) return;
        const entry = list.find((e) => e.messageId === messageId);
        if (!entry) return;
        if (chunk.type === "reasoning") {
          entry.reasoning += chunk.text;
        } else if (chunk.type === "content") {
          entry.content += chunk.text;
        }
        // tool_use and stop chunks are handled by their own events, not here.
      }),

    completeIteration: (runId, info) =>
      set((s) => {
        const list = s.runs[runId];
        if (!list) return;
        const entry = list.find((e) => e.messageId === info.messageId);
        if (!entry) return;
        // Replace accumulated streaming text with the authoritative final
        // values — covers non-streaming responses and any chunk drops.
        entry.content = info.content;
        if (info.reasoning !== undefined) entry.reasoning = info.reasoning;
        entry.finishReason = info.finishReason;
        entry.durationMs = info.durationMs;
        entry.status = "complete";
      }),

    setToolCalls: (runId, messageId, entries) =>
      set((s) => {
        const list = s.runs[runId];
        if (!list) return;
        const entry = list.find((e) => e.messageId === messageId);
        if (!entry) return;
        entry.toolCalls = entries.map((e) => ({ ...e }));
      }),

    updateToolCall: (runId, messageId, entry) =>
      set((s) => {
        const list = s.runs[runId];
        if (!list) return;
        const target = list.find((e) => e.messageId === messageId);
        if (!target) return;
        const idx = target.toolCalls.findIndex((tc) => tc.id === entry.id);
        if (idx === -1) {
          target.toolCalls.push({ ...entry });
        } else {
          target.toolCalls[idx] = { ...entry };
        }
      }),

    clearRun: (runId) =>
      set((s) => {
        delete s.runs[runId];
      }),
  })),
);
