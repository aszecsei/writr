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
