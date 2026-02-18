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

/** JSON Schema subset for tool parameters */
export interface ToolParametersSchema {
  type: "object";
  properties: Record<
    string,
    {
      type: string;
      description?: string;
      enum?: string[];
    }
  >;
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
