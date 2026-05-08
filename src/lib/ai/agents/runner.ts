import { match } from "ts-pattern";
import { getAppSettings } from "@/db/operations/settings";
import type { AgentRunId, AppSettings } from "@/db/schemas";
import type {
  ToolCallEntry,
  ToolCallPayload,
  ToolDefinitionForModel,
} from "../tool-calling";
import type {
  AiMessage,
  AiResponse,
  AiStreamChunk,
  AiUsage,
  FinishReason,
} from "../types";
import { applyDefinitionOverride } from "./applyDefinitionOverride";
import type { PipelineEventEmitter } from "./pipeline/events";
import { makePipelineHistoryAccessor } from "./pipeline/historyAccessor";
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

/**
 * Resolve which provider, model, API key, and reasoning effort an agent should
 * use for its next invocation. Per-agent overrides — set on `agent.modelOverride`
 * by the factory that built the agent (chat or pipeline) — win over global
 * defaults from AppSettings.
 *
 * Pipeline factories populate `agent.modelOverride` from the corresponding
 * AgentDefinition row; chat factories do the same for the row backing the
 * selected agent. There's no longer a settings-level override map.
 */
export function resolveAgentModel(
  agent: Agent,
  settings: AppSettings,
): ResolvedAgentModel {
  const override = agent.modelOverride;

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
 * Headless agent runner. Executes the streaming → tool-call → loop pattern
 * across iterations, dispatching every state change through the supplied
 * `history: ChatHistoryAccessor`. The accessor owns the canonical chat
 * history — the runner doesn't keep a parallel copy. Both the chat panel and
 * the pipeline orchestrator inject their own implementation.
 */
export async function runAgent(
  options: RunAgentOptions,
): Promise<RunAgentResult> {
  const { agent, model, history, stream = true, signal } = options;

  const toolDefinitions: ToolDefinitionForModel[] | undefined =
    getToolDefinitionsForAgent(agent);

  const allToolCalls: ToolCallEntry[] = [];
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

    const iterationMessages = agent.buildMessages({
      history: history.getMessages(),
    });

    const assistantId = history.startAssistantTurn({
      iteration,
      capturedPrompt: isFirstIteration ? iterationMessages : undefined,
    });

    const startTime = Date.now();

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
    let iterationUsage: AiUsage | undefined;
    const collectedToolCalls: ToolCallPayload[] = [];

    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      history.removeAssistantTurn(assistantId);
      const error = await response.json().catch(() => ({}));
      throw new Error(error.details ?? error.error ?? "AI request failed");
    }

    if (stream) {
      if (!response.body) {
        history.removeAssistantTurn(assistantId);
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

          // `stop` is terminal accounting and skips the accessor forward.
          if (chunk.type === "stop") {
            finishReason = chunk.finishReason;
            if (chunk.usage) iterationUsage = chunk.usage;
            continue;
          }
          match(chunk)
            .with({ type: "tool_use" }, (c) => {
              collectedToolCalls.push({
                id: c.id,
                name: c.name,
                input: c.input,
              });
            })
            .with({ type: "reasoning" }, (c) => {
              assistantReasoning = (assistantReasoning ?? "") + c.text;
              history.appendChunk(assistantId, chunk as AiStreamChunk);
            })
            .with({ type: "content" }, (c) => {
              assistantContent += c.text;
              history.appendChunk(assistantId, chunk as AiStreamChunk);
            })
            .exhaustive();
        }
      }
    } else {
      const data: AiResponse = await response.json();
      assistantContent = data.content;
      assistantReasoning = data.reasoning;
      finishReason = data.finishReason;
      iterationUsage = data.usage;
      // Replay the non-streamed content as a single chunk so the accessor's
      // streaming-aware view (chat panel) can render it the same way.
      if (data.content) {
        history.appendChunk(assistantId, {
          type: "content",
          text: data.content,
        });
      }
      if (data.reasoning) {
        history.appendChunk(assistantId, {
          type: "reasoning",
          text: data.reasoning,
        });
      }
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

    if (signal?.aborted) {
      // Abort during streaming — drop the in-progress assistant turn so the
      // UI doesn't show a half-rendered message. The accessor's
      // `removeAssistantTurn` is responsible for cleanup of any pending tool
      // messages it created (this iteration created none yet).
      history.removeAssistantTurn(assistantId);
      aborted = true;
      break;
    }

    const hasToolCalls =
      finishReason === "tool_use" && collectedToolCalls.length > 0;

    history.finalizeAssistantTurn(assistantId, {
      durationMs,
      finishReason,
      usage: iterationUsage,
      ...(hasToolCalls
        ? {
            toolCallRefs: collectedToolCalls.map((tc) => ({
              id: tc.id,
              name: tc.name,
              arguments: tc.input,
            })),
          }
        : {}),
    });

    if (!hasToolCalls) {
      break;
    }

    // Dispatch the full batch of pending tool calls in one accessor call.
    // The accessor maps each entry to a stable tool-message id; the runner
    // uses the parallel id list to drive subsequent approval/execution
    // updates.
    const entries = collectedToolCalls.map(toEntry);
    const toolMessageIds = history.appendPendingToolMessages(
      assistantId,
      entries,
    );

    try {
      for (let i = 0; i < entries.length; i++) {
        if (signal?.aborted) {
          aborted = true;
          break;
        }

        const current = entries[i];
        const toolMsgId = toolMessageIds[i];
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
          history.updateToolMessage(toolMsgId, {
            status: next.status,
            result: next.result,
          });
          continue;
        }

        let working = current;
        if (def.requiresApproval) {
          const approved = history.approveToolCall
            ? await history.approveToolCall(toolMsgId)
            : true;
          if (signal?.aborted) {
            aborted = true;
            break;
          }
          if (!approved) {
            const denied: ToolCallEntry = { ...working, status: "denied" };
            entries[i] = denied;
            history.updateToolMessage(toolMsgId, { status: "denied" });
            continue;
          }
          working = { ...working, status: "approved" };
          entries[i] = working;
          history.updateToolMessage(toolMsgId, { status: "approved" });
        }

        try {
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
          history.updateToolMessage(toolMsgId, {
            status: final.status,
            result: final.result,
          });
        } catch (err) {
          // Tool implementations are expected to return ToolResult, never
          // throw. If one does, mark this entry terminal so the wire format
          // stays internally consistent, then rethrow so callers see the
          // original failure.
          const message = err instanceof Error ? err.message : String(err);
          const errored: ToolCallEntry = {
            ...working,
            status: "error",
            result: { success: false, message },
          };
          entries[i] = errored;
          history.updateToolMessage(toolMsgId, {
            status: errored.status,
            result: errored.result,
          });
          throw err;
        }
      }
    } finally {
      // Whatever happened (clean exit, abort, or rethrown exception), every
      // dispatched tool entry must end at a terminal status — otherwise its
      // tool message stays non-terminal in the chat history, gets dropped
      // by toAiMessages, and orphans the matching tool_use id on the next
      // request.
      for (let k = 0; k < entries.length; k++) {
        const status = entries[k].status;
        if (
          status === "executed" ||
          status === "denied" ||
          status === "error"
        ) {
          continue;
        }
        const cleaned: ToolCallEntry = {
          ...entries[k],
          status: "denied",
          result: { success: false, message: "Aborted by user" },
        };
        entries[k] = cleaned;
        history.updateToolMessage(toolMessageIds[k], {
          status: cleaned.status,
          result: cleaned.result,
        });
      }
    }

    allToolCalls.push(...entries);

    if (aborted) break;
  }

  return {
    iterations: iteration,
    content: lastContent,
    reasoning: lastReasoning,
    finishReason: lastFinishReason,
    toolCalls: allToolCalls,
    aborted,
  };
}

export interface InvokeAgentForRunOptions {
  runId: AgentRunId;
  /**
   * Bare agent built by a builtin factory. The helper applies user-configured
   * definition overrides — callers must NOT call `applyDefinitionOverride`
   * separately or the override will run twice.
   */
  agent: Agent;
  /** Prior conversation history threaded into the first iteration. */
  history?: AiMessage[];
  signal?: AbortSignal;
  /** Receives `agent-*` PipelineEvents stamped with `{ runId, origin }`. */
  onEvent?: PipelineEventEmitter;
}

/**
 * Run a single agent in the context of an existing AgentRun. Wraps `runAgent`
 * with the per-run scaffolding every pipeline phase (planTier, executeTier
 * editors, verifyTier, readerLoop) needs:
 *
 *  - applies user-configured definition overrides to the agent
 *  - resolves the model from current AppSettings
 *  - throws on missing API key (callers' `withRunErrorCapture` writes
 *    status=error; this helper deliberately does not duplicate that write)
 *  - implements `ChatHistoryAccessor` over an in-memory buffer that emits
 *    `agent-*` PipelineEvents (mirroring the legacy callback events) and
 *    accumulates token usage onto the AgentRun row
 */
export async function invokeAgentForRun(
  options: InvokeAgentForRunOptions,
): Promise<RunAgentResult & { history: AiMessage[] }> {
  const {
    runId,
    agent,
    history: initialHistory = [],
    signal,
    onEvent,
  } = options;

  await applyDefinitionOverride(agent);

  const settings = await getAppSettings();
  const model = resolveAgentModel(agent, settings);
  if (!model.apiKey) {
    throw new Error(`No API key configured for provider '${model.provider}'`);
  }

  const accessor = makePipelineHistoryAccessor({
    runId,
    origin: { agentKind: agent.kind, agentId: agent.id },
    initialHistory,
    onEvent,
  });

  const result = await runAgent({
    agent,
    model,
    history: accessor,
    stream: settings.streamResponses,
    signal,
  });

  return { ...result, history: accessor.getMessages() };
}
