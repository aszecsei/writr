import type { AgentRunUsage } from "@/db/schemas";
import type {
  IterationEndInfo,
  IterationStartInfo,
  ToolCallsCollectedInfo,
  ToolCallUpdateInfo,
} from "../types";

/**
 * Lifecycle events emitted by the pipeline run engine. UI consumers subscribe
 * to update the run dashboard live; the engine itself relies on Dexie liveQuery
 * for persistent state, so events are advisory (not required for correctness).
 */
export type PipelineEvent =
  | { type: "reader-pass-start"; runId: string; passNumber: number }
  | {
      type: "reader-pass-complete";
      runId: string;
      passNumber: number;
      delta: {
        newBibleEntries: number;
        newNotes: number;
        newQuestions: number;
      };
    }
  | {
      type: "agent-iteration-start";
      runId: string;
      info: IterationStartInfo;
    }
  | { type: "agent-iteration-end"; runId: string; info: IterationEndInfo }
  | {
      type: "agent-tool-calls";
      runId: string;
      info: ToolCallsCollectedInfo;
    }
  | { type: "agent-tool-update"; runId: string; info: ToolCallUpdateInfo }
  | {
      type: "budget-exceeded";
      runId: string;
      usage: AgentRunUsage;
      budget: number;
    }
  | { type: "run-complete"; runId: string }
  | { type: "run-error"; runId: string; error: string };

export type PipelineEventEmitter = (event: PipelineEvent) => void;
