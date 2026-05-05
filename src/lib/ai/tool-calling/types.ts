// ─── Tool Calling Types ─────────────────────────────────────────────

import type { z } from "zod";

export type ToolCallStatus =
  | "pending"
  | "approved"
  | "denied"
  | "executed"
  | "error";

export interface ToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface ToolExecutionContext {
  projectId: string;
  /** ID of the agent run this tool call belongs to. Set by the agent runner. */
  runId?: string;
  /**
   * Kind of agent invoking the tool. Tools may branch on this — for example,
   * `read_chapter` overlays staged proposed edits when called from an editor
   * agent so a later editor in the same tier sees in-flight changes.
   */
  agentKind?: string;
  /**
   * Highest chapter `order` the agent is permitted to access. Used by the
   * comprehension reader to preserve forward-only reading: chapter-reading
   * tools refuse to return content for chapters with `order` greater than
   * this bound, and list/search tools filter results to `order <= bound`.
   * Undefined means no bound (full project access).
   */
  maxReadableChapterOrder?: number;
  /**
   * Reader-pass number this tool call belongs to (1-based). Set when a reader
   * agent is constructed inside a multi-pass loop so per-pass tools (e.g.
   * `propose_answer`) can stamp their writes with the originating pass.
   */
  passNumber?: number;
}

/** JSON Schema subset used to describe a single property */
export interface ToolParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  /** Element schema when `type` is `"array"` */
  items?: ToolParameterProperty;
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
