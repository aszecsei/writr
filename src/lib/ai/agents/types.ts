import type {
  AgentKind,
  AgentModelOverride,
  AgentRunId,
  AiProvider,
  ReasoningEffort,
} from "@/db/schemas";
import type { ToolCallEntry, ToolExecutionContext } from "../tool-calling";
import type { AiMessage, AiStreamChunk, AiUsage, FinishReason } from "../types";

/**
 * "Manual" represents the synthesized agent that backs the AiPanel chat — its
 * system prompt comes from the existing task-tool selector instead of one of
 * the pipeline kinds. Custom user-defined agents (Phase 4) use "custom".
 */
export type AnyAgentKind = AgentKind | "manual" | "custom";

/**
 * Function that produces the message array for one iteration of the agent
 * loop. The runner calls this on every iteration. `skipUserPrompt` is set on
 * iteration 2+ because the user message is already in `history`.
 */
export type BuildMessagesFn = (params: {
  history: AiMessage[];
  userInput?: string;
  skipUserPrompt?: boolean;
}) => AiMessage[];

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

export interface RunAgentCallbacks {
  /** Fires when a new model iteration begins. */
  onIterationStart?: (info: IterationStartInfo) => void;
  /** Fires for each streaming chunk (content / reasoning / tool_use). */
  onChunk?: (info: { messageId: string; chunk: AiStreamChunk }) => void;
  /** Fires after a model iteration completes (post-stream or non-stream). */
  onIterationEnd?: (info: IterationEndInfo) => void;
  /** Fires once tool calls are extracted from the assistant turn. */
  onToolCallsCollected?: (info: ToolCallsCollectedInfo) => void;
  /**
   * Resolver for tool calls whose tool definition has `requiresApproval: true`.
   * Pipeline agents auto-approve (writes go to staging tables); the AiPanel
   * shows an Approve/Deny UI and resolves with the user's choice.
   */
  approveToolCall?: (entry: ToolCallEntry) => Promise<boolean>;
  /** Fires after each tool call is approved/denied/executed. */
  onToolCallUpdate?: (info: ToolCallUpdateInfo) => void;
}

export interface RunAgentOptions extends RunAgentCallbacks {
  agent: Agent;
  /** User input for the first iteration. Omit for "continue from history". */
  userInput?: string;
  /** Prior conversation history (excluding the first iteration's user input). */
  history?: AiMessage[];
  /** Resolved model + key + provider for this run. */
  model: ResolvedAgentModel;
  /** Whether to stream the response. Defaults to true. */
  stream?: boolean;
  /** Abort signal for the entire run. */
  signal?: AbortSignal;
  /**
   * Optional prompt-assembly knobs forwarded to the API request. Most agents
   * leave these undefined; the manual agent forwards user-configured values.
   */
  postChatInstructions?: string;
  postChatInstructionsDepth?: number;
  assistantPrefill?: string;
  customSystemPrompt?: string | null;
  /** Image attachments for the user prompt. */
  images?: { url: string }[];
}

export interface RunAgentResult {
  iterations: number;
  /** Updated history including all assistant + tool turns produced this run. */
  history: AiMessage[];
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
