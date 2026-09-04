// ─── Tool Calling Types ─────────────────────────────────────────────

import { z } from "zod";
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

type JsonSchemaNode = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonSchemaNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullSchema(node: JsonSchemaNode): boolean {
  return node.type === "null";
}

function variantsOf(node: JsonSchemaNode): JsonSchemaNode[] | undefined {
  const variants = node.oneOf ?? node.anyOf;
  return Array.isArray(variants) ? variants.filter(isPlainObject) : undefined;
}

/**
 * Merge the branches of a discriminated union (or a plain union of object
 * schemas) into a single flattened object schema: a property is required
 * only when every branch declares it required, and enum-valued properties
 * (e.g. a `z.literal()` discriminant) union their allowed values across
 * branches.
 */
function mergeVariants(
  variants: JsonSchemaNode[],
  description?: string,
): ToolParameterProperty {
  const converted = variants.map((v) => toParameterProperty(v));
  const properties: Record<string, ToolParameterProperty> = {};
  const presenceCount = new Map<string, number>();
  const requiredCount = new Map<string, number>();

  for (const variant of converted) {
    const variantProps = variant.properties ?? {};
    const variantRequired = new Set(variant.required ?? []);
    for (const [key, propSchema] of Object.entries(variantProps)) {
      presenceCount.set(key, (presenceCount.get(key) ?? 0) + 1);
      if (variantRequired.has(key)) {
        requiredCount.set(key, (requiredCount.get(key) ?? 0) + 1);
      }
      const existing = properties[key];
      if (!existing) {
        properties[key] = propSchema;
      } else if (existing.enum && propSchema.enum) {
        properties[key] = {
          ...existing,
          enum: [...new Set([...existing.enum, ...propSchema.enum])],
        };
      }
    }
  }

  const required = [...presenceCount.keys()].filter(
    (key) =>
      presenceCount.get(key) === variants.length &&
      requiredCount.get(key) === variants.length,
  );

  return {
    type: "object",
    ...(description ? { description } : {}),
    properties,
    ...(required.length ? { required } : {}),
  };
}

/** Reduce a raw JSON Schema node to the `ToolParameterProperty` subset. */
function toParameterProperty(node: JsonSchemaNode): ToolParameterProperty {
  const description =
    typeof node.description === "string" ? node.description : undefined;

  const variants = variantsOf(node);
  if (variants) {
    const nonNull = variants.filter((v) => !isNullSchema(v));
    if (nonNull.length === 1) {
      return {
        ...toParameterProperty(nonNull[0]),
        ...(description ? { description } : {}),
      };
    }
    return mergeVariants(nonNull, description);
  }

  const type =
    typeof node.type === "string"
      ? node.type
      : typeof node.const === "string"
        ? "string"
        : "string";

  const out: ToolParameterProperty = { type };
  if (description) out.description = description;

  if (Array.isArray(node.enum)) {
    const values = node.enum.filter((v): v is string => typeof v === "string");
    if (values.length) out.enum = values;
  } else if (typeof node.const === "string") {
    out.enum = [node.const];
  }

  if (type === "array" && isPlainObject(node.items)) {
    out.items = toParameterProperty(node.items);
  }

  if (type === "object" && isPlainObject(node.properties)) {
    const requiredKeys = new Set(
      Array.isArray(node.required) ? (node.required as string[]) : [],
    );
    const properties: Record<string, ToolParameterProperty> = {};
    for (const [key, value] of Object.entries(node.properties)) {
      if (isPlainObject(value)) properties[key] = toParameterProperty(value);
    }
    out.properties = properties;
    const required = [...requiredKeys].filter((key) => key in properties);
    if (required.length) out.required = required;
  }

  return out;
}

/**
 * Derive a tool's `parameters` JSON Schema from its Zod `inputSchema`, so the
 * schema sent to the model can't drift from what `execute` actually
 * validates. Reduces `z.toJSONSchema()`'s output to the `ToolParametersSchema`
 * subset the API route and adapters expect (no `$schema`,
 * `additionalProperties`, `minLength`, etc.), and flattens discriminated
 * unions into a single object schema (a property is required only when every
 * branch requires it).
 */
export function zodToToolParameters(schema: z.ZodType): ToolParametersSchema {
  const raw = z.toJSONSchema(schema, {
    unrepresentable: "any",
  }) as JsonSchemaNode;
  const prop = toParameterProperty(raw);
  if (prop.type !== "object") {
    throw new Error("Tool inputSchema must describe an object");
  }
  return {
    type: "object",
    properties: prop.properties ?? {},
    ...(prop.required ? { required: prop.required } : {}),
  };
}

/**
 * Type-safe tool definition helper. Infers the params type from the Zod
 * `inputSchema` so each `execute` function gets fully typed parameters
 * without manual casts. `parameters` is derived from `inputSchema` via
 * `zodToToolParameters()` when not given explicitly.
 */
export function defineTool<S extends z.ZodType>(
  def: Omit<AiToolDefinition, "inputSchema" | "execute" | "parameters"> & {
    parameters?: ToolParametersSchema;
    inputSchema: S;
    execute: (
      params: z.infer<S>,
      context: ToolExecutionContext,
    ) => Promise<ToolResult>;
  },
): AiToolDefinition {
  const parameters = def.parameters ?? zodToToolParameters(def.inputSchema);
  return { ...def, parameters } as unknown as AiToolDefinition;
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
