import type { AgentRunUsage, ReaderMode } from "@/db/schemas";
import type { AiStreamChunk } from "../../types";
import type {
  AnyAgentKind,
  IterationEndInfo,
  IterationStartInfo,
  ToolCallsCollectedInfo,
  ToolCallUpdateInfo,
} from "../types";

/**
 * Identifies which agent produced an event. Stamped by the pipeline tier
 * runners (planTier, executeTier, readerLoop, verifyTier) at the moment they
 * forward callbacks from `runAgent` — `runAgent` itself doesn't know which
 * agent kind it's running.
 */
export interface AgentEventOrigin {
  agentKind: AnyAgentKind;
  /** Stable per-invocation id (e.g. `"editor:wu_42"`). */
  agentId: string;
}

/**
 * Lifecycle events emitted by the pipeline run engine. UI consumers subscribe
 * to update the run dashboard live; the engine itself relies on Dexie liveQuery
 * for persistent state, so events are advisory (not required for correctness).
 */
export type PipelineEvent =
  | {
      type: "reader-pass-start";
      runId: string;
      passNumber: number;
      mode: ReaderMode;
    }
  | {
      type: "reader-pass-complete";
      runId: string;
      passNumber: number;
      mode: ReaderMode;
      delta: {
        newBibleEntries: number;
        newNotes: number;
        newQuestions: number;
      };
    }
  | {
      type: "reader-chapter-start";
      runId: string;
      passNumber: number;
      chapterId: string;
      chapterIndex: number;
      totalChapters: number;
    }
  | {
      type: "reader-chapter-complete";
      runId: string;
      passNumber: number;
      chapterId: string;
      chapterIndex: number;
      totalChapters: number;
      delta: {
        newBibleEntries: number;
        newNotes: number;
        newQuestions: number;
      };
    }
  | {
      type: "agent-iteration-start";
      runId: string;
      origin: AgentEventOrigin;
      info: IterationStartInfo;
    }
  | {
      type: "agent-iteration-end";
      runId: string;
      origin: AgentEventOrigin;
      info: IterationEndInfo;
    }
  | {
      type: "agent-chunk";
      runId: string;
      origin: AgentEventOrigin;
      messageId: string;
      chunk: AiStreamChunk;
    }
  | {
      type: "agent-tool-calls";
      runId: string;
      origin: AgentEventOrigin;
      info: ToolCallsCollectedInfo;
    }
  | {
      type: "agent-tool-update";
      runId: string;
      origin: AgentEventOrigin;
      info: ToolCallUpdateInfo;
    }
  | {
      type: "budget-exceeded";
      runId: string;
      usage: AgentRunUsage;
      budget: number;
    }
  | { type: "run-complete"; runId: string }
  | { type: "run-error"; runId: string; error: string };

export type PipelineEventEmitter = (event: PipelineEvent) => void;
