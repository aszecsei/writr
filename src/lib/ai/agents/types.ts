import type {
  AgentKind,
  AgentModelOverride,
  AgentRunId,
  AiProvider,
  ReasoningEffort,
} from "@/db/schemas";
import type { ToolCallEntry, ToolExecutionContext } from "../tool-calling";
import type { AiMessage, AiUsage, FinishReason } from "../types";
import type { ChatHistoryAccessor } from "./accessor";

/**
 * "Manual" represents the synthesized agent that backs the AiPanel chat — its
 * system prompt comes from the existing task-tool selector instead of one of
 * the pipeline kinds. Custom user-defined agents (Phase 4) use "custom".
 */
export type AnyAgentKind = AgentKind | "manual" | "custom";

/**
 * Function that produces the messages for one iteration of the agent loop.
 * The runner calls this on every iteration. `history` is the full canonical
 * conversation in wire format — user messages, assistant turns (with their
 * `toolCalls` ref arrays), and `role: "tool"` result rows — already
 * containing whatever the user said. The function wraps it with system +
 * context preamble and (optionally) an assistant prefill.
 */
export type BuildMessagesFn = (params: { history: AiMessage[] }) => AiMessage[];

/**
 * A first-class agent: a typed configuration of model + prompt + tool subset
 * that can be run through the headless `runAgent()` function. Built-in pipeline
 * agents (reader, orchestrator, editor, verifier) come from factories under
 * `src/lib/ai/agents/builtins/`. The AiPanel chat synthesizes a "manual" agent
 * to preserve its existing UX.
 */
export interface Agent {
  /** Unique per invocation (e.g. `"editor:wu_42"`). Used for run-scoped logs. */
  id: string;
  kind: AnyAgentKind;
  /** When set, scopes tool execution to a specific pipeline run. */
  runId?: AgentRunId;
  /**
   * Per-agent model override. When omitted, the runner falls back to the
   * global `AppSettings.aiProvider` / `providerModels` / `reasoningEffort`.
   */
  modelOverride?: AgentModelOverride;
  /**
   * Whitelist of tool ids the agent may use. When omitted, tools are still
   * gated by `enableToolCalling`. Pipeline agents always set this to a tight
   * subset; the manual agent leaves it undefined.
   */
  allowedToolIds?: string[];
  /** Whether to send tool definitions to the model at all. */
  enableToolCalling?: boolean;
  /** Soft cap on streaming iterations (each tool round = 1 iteration). */
  maxIterations?: number;
  /** Builds messages for each iteration. */
  buildMessages: BuildMessagesFn;
  /** Tool execution context — projectId, runId, agentKind. */
  agentContext: ToolExecutionContext;
  /**
   * Pre-rendered system content, exposed for prompt-inspector UIs. Not used by
   * the runner directly (assembly happens inside `buildMessages`).
   */
  systemPrompt?: string;
}

/**
 * Concrete model resolution for one agent invocation. Produced by
 * `resolveAgentModel(agent, settings)`.
 */
export interface ResolvedAgentModel {
  apiKey: string;
  provider: AiProvider;
  model: string;
  reasoningEffort?: ReasoningEffort;
}

/**
 * Lifecycle event payloads emitted by the pipeline path's accessor (and
 * consumed by `agentActivityStore` and `pipeline/events.ts`). The chat panel
 * doesn't emit these — it drives the UI directly via `setMessages`.
 */
export interface IterationStartInfo {
  messageId: string;
  iteration: number;
  /** The full prompt sent to the model — captured on iteration 1 only. */
  capturedPrompt?: AiMessage[];
}

export interface IterationEndInfo {
  messageId: string;
  iteration: number;
  content: string;
  reasoning?: string;
  finishReason?: FinishReason;
  durationMs: number;
  /**
   * Token usage as reported by the provider. Undefined when the upstream
   * stream omitted usage (some OpenRouter routes) — pipeline accounting falls
   * back to its prior value in that case.
   */
  usage?: AiUsage;
}

export interface ToolCallsCollectedInfo {
  messageId: string;
  iteration: number;
  entries: ToolCallEntry[];
}

export interface ToolCallUpdateInfo {
  messageId: string;
  iteration: number;
  entry: ToolCallEntry;
}

export interface RunAgentOptions {
  agent: Agent;
  /** Resolved model + key + provider for this run. */
  model: ResolvedAgentModel;
  /**
   * Canonical chat history accessor. Replaces the prior callback bag plus
   * the runner's internal `workingHistory`. The chat panel and the pipeline
   * each provide their own implementation.
   */
  history: ChatHistoryAccessor;
  /** Whether to stream the response. Defaults to true. */
  stream?: boolean;
  /** Abort signal for the entire run. */
  signal?: AbortSignal;
}

export interface RunAgentResult {
  iterations: number;
  /** Final assistant content (last turn). */
  content: string;
  reasoning?: string;
  finishReason?: FinishReason;
  /** All tool calls executed across iterations. */
  toolCalls: ToolCallEntry[];
  /** True when aborted via signal. */
  aborted: boolean;
}

export type { ToolCallEntry, ToolExecutionContext };
