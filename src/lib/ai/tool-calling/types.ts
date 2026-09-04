// ─── Tool Calling Types ─────────────────────────────────────────────

import type { z } from "zod";
import type { ProjectId } from "@/db/schemas";

type ToolCallStatus = "pending" | "approved" | "denied" | "executed" | "error";

export interface ToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

/** A request from an orchestrator to run a named sub-agent on a subtask. */
export interface DelegateRequest {
  /** Name or id of the sub-agent to run. */
  agent: string;
  /** The fully-specified, self-contained subtask. */
  prompt: string;
}

/** The result of a delegated sub-agent run. */
interface DelegateOutcome {
  /** The sub-agent's final text answer. */
  answer: string;
  /** True if the run was cancelled before producing a final answer. */
  aborted: boolean;
}

/** A request to pause and ask the user to pick one of several options. */
export interface ChoiceRequest {
  question: string;
  options: string[];
}

/**
 * Host the chat panel injects so the `delegate` and `present_choice` tools can
 * run sub-agents and surface user prompts without reaching into React state
 * themselves. Present ONLY in interactive chat-panel invocations; both tools
 * fail gracefully when it's undefined.
 */
export interface DelegationHost {
  /** Current nesting depth; 0 = the top-level orchestrator. */
  depth: number;
  /** Agent-definition ids already in the current chain (cycle guard). */
  ancestry: ReadonlySet<string>;
  /**
   * Run a sub-agent to completion and return its final answer.
   * `parentToolMessageId` is the delegate tool call's message id, used to
   * render the sub-agent transcript nested under it.
   */
  runSubAgent(
    req: DelegateRequest,
    parentToolMessageId?: string,
  ): Promise<DelegateOutcome>;
  /** Ask the user to pick an option; resolves with the chosen option text. */
  requestChoice(req: ChoiceRequest): Promise<string>;
}

export interface ToolExecutionContext {
  projectId: ProjectId;
  /**
   * The chat-message id of the tool call currently executing. Set by the agent
   * runner per tool call so a tool can correlate side effects with its own
   * message row — `delegate` uses it to attach the sub-agent transcript to the
   * delegate call. Undefined outside the chat runner.
   */
  toolMessageId?: string;
  /**
   * Sub-agent delegation machinery. Set by the AiPanel accessor on the agent's
   * `agentContext` so the `delegate` / `present_choice` tools can run nested
   * agents and bubble user-facing gates to the top-level panel.
   */
  delegation?: DelegationHost;
}

/** JSON Schema subset used to describe a single property */
export interface ToolParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  /** Element schema when `type` is `"array"` */
  items?: ToolParameterProperty;
  /** Nested object properties when `type` is `"object"`. */
  properties?: Record<string, ToolParameterProperty>;
  /** Required nested-object property names. */
  required?: string[];
}

/** JSON Schema subset for tool parameters */
export interface ToolParametersSchema {
  type: "object";
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface AiToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: ToolParametersSchema;
  inputSchema: z.ZodType;
  requiresApproval: boolean;
  execute: (
    params: Record<string, unknown>,
    context: ToolExecutionContext,
  ) => Promise<ToolResult>;
}

/**
 * Type-safe tool definition helper. Infers the params type from the Zod
 * `inputSchema` so each `execute` function gets fully typed parameters
 * without manual casts.
 */
export function defineTool<S extends z.ZodType>(
  def: Omit<AiToolDefinition, "inputSchema" | "execute"> & {
    inputSchema: S;
    execute: (
      params: z.infer<S>,
      context: ToolExecutionContext,
    ) => Promise<ToolResult>;
  },
): AiToolDefinition {
  return def as unknown as AiToolDefinition;
}

/** Subset sent to the API / model */
export interface ToolDefinitionForModel {
  id: string;
  name: string;
  description: string;
  parameters: ToolParametersSchema;
}

/** Wire format: what the model returns */
export interface ToolCallPayload {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** UI state for a tool call within a message */
export interface ToolCallEntry {
  id: string;
  toolName: string;
  displayName: string;
  input: Record<string, unknown>;
  status: ToolCallStatus;
  result?: ToolResult;
}
