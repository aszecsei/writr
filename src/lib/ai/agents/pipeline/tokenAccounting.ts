import { addTokenUsage, updateAgentRun } from "@/db/operations/agentRuns";
import type { RunAgentCallbacks } from "../types";

/**
 * Wrap a set of `runAgent` callbacks so each iteration's reported usage is
 * persisted onto the agent run row:
 *
 *  - `totalTokenUsage` is incremented atomically by the iteration's
 *    `prompt_tokens` and `completion_tokens` (sum across all iterations is the
 *    cumulative billed spend for the run; tool-result content is naturally
 *    included in subsequent iterations' `prompt_tokens`).
 *  - `lastIterationPromptTokens` is overwritten with the latest iteration's
 *    `prompt_tokens`, surfaced in the UI as a context-window pressure gauge.
 *
 * When an iteration's `usage` is undefined (some upstreams omit it), the
 * wrapper leaves both counters untouched rather than fall back to a character
 * approximation — undercounting is more honest than mixing real and synthetic
 * numbers in the same total.
 */
export function withTokenAccounting(
  runId: string,
  callbacks: RunAgentCallbacks,
): RunAgentCallbacks {
  const innerOnIterationEnd = callbacks.onIterationEnd;
  return {
    ...callbacks,
    onIterationEnd: async (info) => {
      if (info.usage) {
        await addTokenUsage(runId, {
          promptTokens: info.usage.prompt_tokens,
          completionTokens: info.usage.completion_tokens,
          cacheCreationTokens: info.usage.cache_creation_tokens ?? 0,
          cacheReadTokens: info.usage.cache_read_tokens ?? 0,
        });
        await updateAgentRun(runId, {
          lastIterationPromptTokens: info.usage.prompt_tokens,
        });
      }
      await innerOnIterationEnd?.(info);
    },
  };
}
