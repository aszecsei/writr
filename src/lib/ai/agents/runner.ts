import { match } from "ts-pattern";
import type { AppSettings } from "@/db/schemas";
import type {
  ToolCallEntry,
  ToolCallPayload,
  ToolDefinitionForModel,
} from "../tool-calling";
import { isTerminalToolStatus } from "../tool-calling";
import type {
  AiResponse,
  AiStreamChunk,
  AiUsage,
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

/**
 * Resolve which provider, model, API key, and reasoning effort an agent should
 * use for its next invocation. Per-agent overrides — set on `agent.modelOverride`
 * by the chat factory that built the agent — win over global defaults from
 * AppSettings.
 *
 * Chat factories populate `agent.modelOverride` from the AgentDefinition row
 * backing the selected agent. There's no settings-level override map.
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
 * history — the runner doesn't keep a parallel copy. The chat panel injects
 * its own implementation.
 */
export async function runAgent(
  options: RunAgentOptions,
): Promise<RunAgentResult> {
  const { agent, model, history, stream = true, signal } = options;

  const toolDefinitions: ToolDefinitionForModel[] | undefined =
    getToolDefinitionsForAgent(agent);

  let iteration = 0;
  const maxIterations = agent.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  let lastContent = "";
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
            .with({ type: "reasoning" }, () => {
              history.appendChunk(assistantId, chunk);
            })
            .with({ type: "content" }, (c) => {
              assistantContent += c.text;
              history.appendChunk(assistantId, chunk);
            })
            .exhaustive();
        }
      }
    } else {
      const data: AiResponse = await response.json();
      assistantContent = data.content;
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
            toolMsgId,
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
        if (isTerminalToolStatus(entries[k].status)) continue;
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

    if (aborted) break;
  }

  return {
    content: lastContent,
    aborted,
  };
}
