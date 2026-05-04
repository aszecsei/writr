import type { AppSettings } from "@/db/schemas";
import type {
  ToolCallEntry,
  ToolCallPayload,
  ToolDefinitionForModel,
} from "../tool-calling";
import type {
  AiMessage,
  AiResponse,
  AiStreamChunk,
  AiToolCall,
  FinishReason,
} from "../types";
import {
  executeAgentTool,
  getAgentToolDefinition,
  getToolDefinitionsForAgent,
} from "./tool-filter";
import type {
  Agent,
  ResolvedAgentModel,
  RunAgentOptions,
  RunAgentResult,
} from "./types";

const DEFAULT_MAX_ITERATIONS = 16;

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Resolve which provider, model, API key, and reasoning effort an agent should
 * use for its next invocation. Per-agent overrides (when set on AppSettings)
 * win over the global defaults; "manual" never has overrides.
 */
export function resolveAgentModel(
  agent: Agent,
  settings: AppSettings,
): ResolvedAgentModel {
  const inlineOverride = agent.modelOverride;
  const settingsOverride =
    agent.kind === "reader" ||
    agent.kind === "orchestrator" ||
    agent.kind === "editor" ||
    agent.kind === "verifier"
      ? settings.agentModelOverrides[agent.kind]
      : null;

  const override = inlineOverride ?? settingsOverride ?? undefined;

  if (override) {
    return {
      provider: override.provider,
      model: override.model,
      apiKey: settings.providerApiKeys[override.provider],
      reasoningEffort: override.reasoningEffort ?? settings.reasoningEffort,
    };
  }

  return {
    provider: settings.aiProvider,
    model: settings.providerModels[settings.aiProvider],
    apiKey: settings.providerApiKeys[settings.aiProvider],
    reasoningEffort: settings.reasoningEffort,
  };
}

/**
 * Convert the wire-format tool call returned by the model into an internal
 * `ToolCallEntry`, with status set based on whether the tool definition
 * requires human approval.
 */
function toEntry(payload: ToolCallPayload): ToolCallEntry {
  const def = getAgentToolDefinition(payload.name);
  return {
    id: payload.id,
    toolName: payload.name,
    displayName: def?.name ?? payload.name,
    input: payload.input,
    status: def?.requiresApproval ? "pending" : "approved",
  };
}

/**
 * Append the assistant turn (with any tool calls) and matching tool-result
 * messages to the working history so the next iteration sees them.
 */
function extendHistoryWithIteration(
  history: AiMessage[],
  assistantContent: string,
  entries: ToolCallEntry[],
): AiMessage[] {
  const next: AiMessage[] = [...history];
  const toolCalls: AiToolCall[] = entries.map((e) => ({
    id: e.id,
    name: e.toolName,
    arguments: e.input,
  }));

  next.push({
    role: "assistant",
    content: assistantContent,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
  });

  for (const entry of entries) {
    if (
      entry.status !== "executed" &&
      entry.status !== "denied" &&
      entry.status !== "error"
    ) {
      continue;
    }
    const content =
      entry.status === "denied"
        ? JSON.stringify({ success: false, message: "Denied by user" })
        : JSON.stringify(
            entry.result ?? { success: false, message: "No result" },
          );
    next.push({
      role: "tool",
      content,
      toolCallId: entry.id,
    });
  }

  return next;
}

/**
 * Headless agent runner. Executes the streaming → tool-call → loop pattern
 * previously inlined in `AiPanel.generateAiResponse`. The pipeline orchestrator
 * calls this programmatically (auto-approving tool calls); AiPanel calls it
 * with a UI-driven `approveToolCall` handler.
 */
export async function runAgent(
  options: RunAgentOptions,
): Promise<RunAgentResult> {
  const {
    agent,
    userInput,
    history: initialHistory = [],
    model,
    stream = true,
    signal,
    onIterationStart,
    onChunk,
    onIterationEnd,
    onToolCallsCollected,
    approveToolCall,
    onToolCallUpdate,
  } = options;

  const toolDefinitions: ToolDefinitionForModel[] | undefined =
    getToolDefinitionsForAgent(agent);

  const allToolCalls: ToolCallEntry[] = [];
  let workingHistory = initialHistory;
  let iteration = 0;
  const maxIterations = agent.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  let lastContent = "";
  let lastReasoning: string | undefined;
  let lastFinishReason: FinishReason | undefined;
  let aborted = false;

  while (iteration < maxIterations) {
    if (signal?.aborted) {
      aborted = true;
      break;
    }

    iteration += 1;
    const isFirstIteration = iteration === 1;
    const messageId = generateId();

    const iterationMessages = agent.buildMessages({
      history: workingHistory,
      userInput,
      skipUserPrompt: !isFirstIteration,
    });

    onIterationStart?.({
      messageId,
      iteration,
      capturedPrompt: isFirstIteration ? iterationMessages : undefined,
    });

    const startTime = Date.now();

    // Pre-built messages bypass the legacy task-tool flow in client.ts —
    // agents own their own prompt assembly via `agent.buildMessages`.
    const requestBody = {
      apiKey: model.apiKey,
      model: model.model,
      provider: model.provider,
      messages: iterationMessages,
      temperature: 0.5,
      max_tokens: 24 * 1024,
      stream,
      ...(model.reasoningEffort && model.reasoningEffort !== "none"
        ? { reasoning: { effort: model.reasoningEffort } }
        : {}),
      ...(toolDefinitions && toolDefinitions.length > 0
        ? { tools: toolDefinitions }
        : {}),
    };

    let assistantContent = "";
    let assistantReasoning: string | undefined;
    let finishReason: FinishReason | undefined;
    const collectedToolCalls: ToolCallPayload[] = [];

    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.details ?? error.error ?? "AI request failed");
    }

    if (stream) {
      if (!response.body) {
        throw new Error("No response body for streaming request");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      streamLoop: while (true) {
        if (signal?.aborted) {
          aborted = true;
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const json = trimmed.slice(6);
          if (json === "[DONE]") break streamLoop;

          let chunk: AiStreamChunk | undefined;
          try {
            chunk = JSON.parse(json) as AiStreamChunk;
          } catch {
            continue;
          }

          if (chunk.type === "stop") {
            finishReason = chunk.finishReason;
            continue;
          }
          if (chunk.type === "tool_use") {
            collectedToolCalls.push({
              id: chunk.id,
              name: chunk.name,
              input: chunk.input,
            });
          } else if (chunk.type === "reasoning") {
            assistantReasoning = (assistantReasoning ?? "") + chunk.text;
          } else if (chunk.type === "content") {
            assistantContent += chunk.text;
          }
          onChunk?.({ messageId, chunk });
        }
      }
    } else {
      const data: AiResponse = await response.json();
      assistantContent = data.content;
      assistantReasoning = data.reasoning;
      finishReason = data.finishReason;
      if (data.toolCalls) {
        for (const tc of data.toolCalls) {
          collectedToolCalls.push({
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
      }
    }

    const durationMs = Date.now() - startTime;
    lastContent = assistantContent;
    lastReasoning = assistantReasoning;
    lastFinishReason = finishReason;

    // Skip the lifecycle callback when aborted — AiPanel uses the absence of
    // durationMs/finishReason on a message to detect incomplete iterations and
    // remove them in handleCancel.
    if (signal?.aborted) {
      aborted = true;
      break;
    }

    onIterationEnd?.({
      messageId,
      iteration,
      content: assistantContent,
      reasoning: assistantReasoning,
      finishReason,
      durationMs,
    });

    // No tool calls — this iteration finished the run.
    if (finishReason !== "tool_use" || collectedToolCalls.length === 0) {
      workingHistory = extendHistoryWithIteration(
        workingHistory,
        assistantContent,
        [],
      );
      break;
    }

    // Process tool calls sequentially. Each `onToolCallUpdate` callback
    // receives a freshly-cloned entry so React state mutations don't race
    // with reference identity checks.
    const entries = collectedToolCalls.map(toEntry);
    onToolCallsCollected?.({ messageId, iteration, entries });

    for (let i = 0; i < entries.length; i++) {
      if (signal?.aborted) {
        aborted = true;
        break;
      }

      const current = entries[i];
      const def = getAgentToolDefinition(current.toolName);

      if (!def) {
        const next: ToolCallEntry = {
          ...current,
          status: "error",
          result: {
            success: false,
            message: `Unknown tool: ${current.toolName}`,
          },
        };
        entries[i] = next;
        onToolCallUpdate?.({ messageId, iteration, entry: next });
        continue;
      }

      let working = current;
      if (def.requiresApproval) {
        const approved = approveToolCall
          ? await approveToolCall(working)
          : true;
        if (signal?.aborted) {
          aborted = true;
          break;
        }
        if (!approved) {
          const denied: ToolCallEntry = { ...working, status: "denied" };
          entries[i] = denied;
          onToolCallUpdate?.({ messageId, iteration, entry: denied });
          continue;
        }
        working = { ...working, status: "approved" };
        entries[i] = working;
        onToolCallUpdate?.({ messageId, iteration, entry: working });
      }

      const result = await executeAgentTool(
        agent,
        working.toolName,
        working.input,
      );
      const final: ToolCallEntry = {
        ...working,
        status: result.success ? "executed" : "error",
        result,
      };
      entries[i] = final;
      onToolCallUpdate?.({ messageId, iteration, entry: final });
    }

    allToolCalls.push(...entries);

    workingHistory = extendHistoryWithIteration(
      workingHistory,
      assistantContent,
      entries,
    );

    if (aborted) break;
  }

  return {
    iterations: iteration,
    history: workingHistory,
    content: lastContent,
    reasoning: lastReasoning,
    finishReason: lastFinishReason,
    toolCalls: allToolCalls,
    aborted,
  };
}
