import {
  AI_TOOL_MAP,
  AI_TOOLS,
  executeTool,
  type ToolDefinitionForModel,
  type ToolExecutionContext,
  type ToolResult,
} from "../tool-calling";
import {
  GET_CATEGORIES,
  LIST_CATEGORIES,
  permittedCategories,
  type ReadCategory,
} from "../tool-calling/tools/registry";
import type { Agent } from "./types";

/**
 * Tool definitions exposed to the model for this agent. Filters by
 * `agent.allowedToolIds` when set; otherwise returns all registered tools.
 * When `agent.enableToolCalling` is false, returns undefined so callers can
 * omit the `tools` field from the request body entirely.
 *
 * The consolidated `list` / `get` tools accept scoped ids in
 * `allowedToolIds` (`list:character`, `get:summary`, ...). When scoped,
 * the surfaced tool's `category` enum is narrowed so the model only sees
 * categories it can read — both for the `list({ category })` and the
 * `get({ requests: [{ category, ... }] })` shapes.
 */
export function getToolDefinitionsForAgent(
  agent: Agent,
): ToolDefinitionForModel[] | undefined {
  if (!agent.enableToolCalling) return undefined;

  const allowed = agent.allowedToolIds;
  if (!allowed) {
    return AI_TOOLS.map(({ id, name, description, parameters }) => ({
      id,
      name,
      description,
      parameters,
    }));
  }

  const allowedSet = new Set(allowed);
  const listScope = permittedCategories("list", allowed);
  const getScope = permittedCategories("get", allowed);

  const out: ToolDefinitionForModel[] = [];
  for (const t of AI_TOOLS) {
    if (t.id === "list") {
      if (!listScope) continue;
      out.push({
        id: t.id,
        name: t.name,
        description: t.description,
        parameters:
          listScope === "all"
            ? t.parameters
            : narrowCategoryEnum(t.parameters, "category", listScope),
      });
      continue;
    }
    if (t.id === "get") {
      if (!getScope) continue;
      out.push({
        id: t.id,
        name: t.name,
        description: t.description,
        parameters:
          getScope === "all"
            ? t.parameters
            : narrowGetRequestsEnum(t.parameters, getScope),
      });
      continue;
    }
    if (allowedSet.has(t.id)) {
      out.push({
        id: t.id,
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      });
    }
  }
  return out;
}

/**
 * Execute a tool on behalf of an agent. Validates that the tool is permitted
 * for the agent (when `allowedToolIds` is set) before delegating to the
 * existing `executeTool()`. For consolidated `list` / `get` calls, also
 * verifies the requested categories are within the agent's scoped
 * permissions — defense in depth against a model that ignored the narrowed
 * enum sent in the tool definition.
 */
export async function executeAgentTool(
  agent: Agent,
  toolId: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  if (agent.allowedToolIds) {
    if (toolId === "list") {
      const scope = permittedCategories("list", agent.allowedToolIds);
      if (!scope) return permissionError(toolId, agent.kind);
      if (scope !== "all") {
        const cat = (params as { category?: string }).category;
        if (typeof cat !== "string" || !scope.has(cat as ReadCategory)) {
          return categoryNotPermittedError("list", cat, agent.kind);
        }
      }
    } else if (toolId === "get") {
      const scope = permittedCategories("get", agent.allowedToolIds);
      if (!scope) return permissionError(toolId, agent.kind);
      if (scope !== "all") {
        const requests = (params as { requests?: { category?: string }[] })
          .requests;
        if (Array.isArray(requests)) {
          for (const r of requests) {
            const cat = r?.category;
            if (typeof cat !== "string" || !scope.has(cat as ReadCategory)) {
              return categoryNotPermittedError("get", cat, agent.kind);
            }
          }
        }
      }
    } else if (!agent.allowedToolIds.includes(toolId)) {
      return permissionError(toolId, agent.kind);
    }
  }

  const context: ToolExecutionContext = {
    ...agent.agentContext,
    runId: agent.agentContext.runId ?? agent.runId,
    agentKind: agent.agentContext.agentKind ?? agent.kind,
  };

  return executeTool(toolId, params, context);
}

function permissionError(toolId: string, agentKind: string): ToolResult {
  return {
    success: false,
    message: `Tool '${toolId}' is not permitted for agent '${agentKind}'.`,
  };
}

function categoryNotPermittedError(
  verb: "list" | "get",
  category: string | undefined,
  agentKind: string,
): ToolResult {
  return {
    success: false,
    message: `Category '${category ?? "<missing>"}' is not permitted for ${verb} on agent '${agentKind}'.`,
  };
}

/**
 * Return a copy of the parameters schema with the `categoryProp` enum
 * restricted to `allowed`. Used to narrow the `list` tool's category enum.
 */
function narrowCategoryEnum(
  parameters: ToolDefinitionForModel["parameters"],
  categoryProp: string,
  allowed: ReadonlySet<ReadCategory>,
): ToolDefinitionForModel["parameters"] {
  const next: ToolDefinitionForModel["parameters"] = {
    ...parameters,
    properties: { ...parameters.properties },
  };
  const orig = parameters.properties[categoryProp];
  if (orig) {
    next.properties[categoryProp] = {
      ...orig,
      enum: LIST_CATEGORIES.filter((c) => allowed.has(c)) as string[],
    };
  }
  return next;
}

/**
 * Narrow the nested `requests[].category` enum on the `get` tool's
 * parameters. Mirrors `narrowCategoryEnum` for the array-of-requests shape.
 */
function narrowGetRequestsEnum(
  parameters: ToolDefinitionForModel["parameters"],
  allowed: ReadonlySet<ReadCategory>,
): ToolDefinitionForModel["parameters"] {
  const requestsProp = parameters.properties.requests;
  if (!requestsProp?.items?.properties?.category) return parameters;
  const itemProps = requestsProp.items.properties;
  return {
    ...parameters,
    properties: {
      ...parameters.properties,
      requests: {
        ...requestsProp,
        items: {
          ...requestsProp.items,
          properties: {
            ...itemProps,
            category: {
              ...itemProps.category,
              enum: GET_CATEGORIES.filter((c) => allowed.has(c)) as string[],
            },
          },
        },
      },
    },
  };
}

/** Look up a tool definition by id (for status display, approval gating). */
export function getAgentToolDefinition(toolId: string) {
  return AI_TOOL_MAP.get(toolId);
}
