import type {
  AgentKind,
  AgentModelOverride,
  AiProvider,
  ReasoningEffort,
} from "@/db/schemas";
import type { ToolExecutionContext } from "../tool-calling";
import type { AiMessage } from "../types";
import type { ChatHistoryAccessor } from "./accessor";

/** Custom user-defined agents use "custom"; built-in kinds use `AgentKind`. */
type AnyAgentKind = AgentKind | "custom";

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
 * agents come from factories under `src/lib/ai/agents/builtins/`.
 */
export interface Agent {
  kind: AnyAgentKind;
  /**
   * Per-agent model override. When omitted, the runner falls back to the
   * global `AppSettings.aiProvider` / `providerModels` / `reasoningEffort`.
   */
  modelOverride?: AgentModelOverride;
  /**
   * Whitelist of tool ids the agent may use. When omitted, tools are still
   * gated by `enableToolCalling`. Built-in chat agents set this to a tight
   * subset; agents with no tool access leave it undefined.
   */
  allowedToolIds?: string[];
  /** Whether to send tool definitions to the model at all. */
  enableToolCalling?: boolean;
  /** Soft cap on streaming iterations (each tool round = 1 iteration). */
  maxIterations?: number;
  /** Builds messages for each iteration. */
  buildMessages: BuildMessagesFn;
  /** Tool execution context — projectId, delegation host. */
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
  /** Final assistant content (last turn). */
  content: string;
  /** True when aborted via signal. */
  aborted: boolean;
}
