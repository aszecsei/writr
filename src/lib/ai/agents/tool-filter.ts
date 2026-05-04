import {
  AI_TOOL_MAP,
  AI_TOOLS,
  executeTool,
  type ToolDefinitionForModel,
  type ToolExecutionContext,
  type ToolResult,
} from "../tool-calling";
import type { Agent } from "./types";

/**
 * Tool definitions exposed to the model for this agent. Filters by
 * `agent.allowedToolIds` when set; otherwise returns all registered tools.
 * When `agent.enableToolCalling` is false, returns undefined so callers can
 * omit the `tools` field from the request body entirely.
 */
export function getToolDefinitionsForAgent(
  agent: Agent,
): ToolDefinitionForModel[] | undefined {
  if (!agent.enableToolCalling) return undefined;

  const allowed = agent.allowedToolIds;
  const source = allowed
    ? AI_TOOLS.filter((t) => allowed.includes(t.id))
    : AI_TOOLS;

  return source.map(({ id, name, description, parameters }) => ({
    id,
    name,
    description,
    parameters,
  }));
}

/**
 * Execute a tool on behalf of an agent. Validates that the tool is permitted
 * for the agent (when `allowedToolIds` is set) before delegating to the
 * existing `executeTool()`.
 */
export async function executeAgentTool(
  agent: Agent,
  toolId: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  if (agent.allowedToolIds && !agent.allowedToolIds.includes(toolId)) {
    return {
      success: false,
      message: `Tool '${toolId}' is not permitted for agent '${agent.kind}'.`,
    };
  }

  const context: ToolExecutionContext = {
    ...agent.agentContext,
    runId: agent.agentContext.runId ?? agent.runId,
    agentKind: agent.agentContext.agentKind ?? agent.kind,
  };

  return executeTool(toolId, params, context);
}

/** Look up a tool definition by id (for status display, approval gating). */
export function getAgentToolDefinition(toolId: string) {
  return AI_TOOL_MAP.get(toolId);
}
