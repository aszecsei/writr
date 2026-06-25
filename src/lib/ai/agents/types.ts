import type {
  AgentKind,
  AgentModelOverride,
  AiProvider,
  ReasoningEffort,
} from "@/db/schemas";
import type { ToolCallEntry, ToolExecutionContext } from "../tool-calling";
import type { AiMessage, FinishReason } from "../types";
import type { ChatHistoryAccessor } from "./accessor";

/**
 * "Manual" represents the synthesized agent that backs the AiPanel chat — its
 * system prompt comes from the existing task-tool selector instead of a
 * built-in agent kind. Custom user-defined agents use "custom".
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
 * that can be run through the headless `runAgent()` function. Built-in chat
 * agents come from factories under `src/lib/ai/agents/builtins/`. The AiPanel
 * chat synthesizes a "manual" agent to preserve its existing UX.
 */
export interface Agent {
  /** Unique per invocation. Used for logging / correlation. */
  id: string;
  kind: AnyAgentKind;
  /**
   * Per-agent model override. When omitted, the runner falls back to the
   * global `AppSettings.aiProvider` / `providerModels` / `reasoningEffort`.
   */
  modelOverride?: AgentModelOverride;
  /**
   * Whitelist of tool ids the agent may use. When omitted, tools are still
   * gated by `enableToolCalling`. Built-in chat agents set this to a tight
   * subset; the manual agent leaves it undefined.
   */
  allowedToolIds?: string[];
  /** Whether to send tool definitions to the model at all. */
  enableToolCalling?: boolean;
  /** Soft cap on streaming iterations (each tool round = 1 iteration). */
  maxIterations?: number;
  /** Builds messages for each iteration. */
  buildMessages: BuildMessagesFn;
  /** Tool execution context — projectId, agentKind. */
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

export interface RunAgentOptions {
  agent: Agent;
  /** Resolved model + key + provider for this run. */
  model: ResolvedAgentModel;
  /**
   * Canonical chat history accessor. The chat panel provides its own
   * implementation.
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
