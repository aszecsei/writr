"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { BUTTON_CANCEL } from "@/components/ui/form-styles";
import type { ToolCallEntry } from "@/lib/ai/tool-calling/types";
import {
  type ActivityIteration,
  useAgentActivityStore,
} from "@/store/agentActivityStore";

interface ActivityPanelProps {
  runId: string;
}

const AGENT_KIND_STYLES: Record<string, string> = {
  reader: "bg-sky-500",
  orchestrator: "bg-violet-500",
  editor: "bg-emerald-500",
  verifier: "bg-amber-500",
  manual: "bg-neutral-500",
  custom: "bg-neutral-500",
};

const TOOL_STATUS_STYLES: Record<ToolCallEntry["status"], string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  approved: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  executed:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  denied:
    "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  error: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

export function ActivityPanel({ runId }: ActivityPanelProps) {
  const iterations = useAgentActivityStore((s) => s.runs[runId]);
  const clearRun = useAgentActivityStore((s) => s.clearRun);

  // Newest first so live activity is visible without scrolling.
  const sorted = useMemo(() => {
    if (!iterations) return [];
    return [...iterations].sort((a, b) => b.startedAt - a.startedAt);
  }, [iterations]);

  if (sorted.length === 0) {
    return (
      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        No agent activity yet. Start a Reader pass, plan a tier, or execute one
        — LLM reasoning, content, and tool calls will stream here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {sorted.length} iteration{sorted.length === 1 ? "" : "s"} · ephemeral
          (cleared on reload)
        </p>
        <button
          type="button"
          onClick={() => clearRun(runId)}
          className={BUTTON_CANCEL}
        >
          Clear log
        </button>
      </div>

      <ul className="space-y-3">
        {sorted.map((it) => (
          <li key={it.messageId}>
            <IterationCard iteration={it} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function IterationCard({ iteration }: { iteration: ActivityIteration }) {
  const dotClass = AGENT_KIND_STYLES[iteration.agentKind] ?? "bg-neutral-500";
  const isStreaming = iteration.status === "streaming";

  return (
    <div className="rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass} ${
              isStreaming ? "animate-pulse" : ""
            }`}
            aria-hidden
          />
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {iteration.agentKind}
          </span>
          <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
            {iteration.agentId}
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            · iter {iteration.iteration}
          </span>
        </div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          {isStreaming ? (
            <span className="text-primary-600 dark:text-primary-400">
              streaming…
            </span>
          ) : (
            <>
              {iteration.finishReason ?? "done"}
              {iteration.durationMs !== undefined && (
                <> · {(iteration.durationMs / 1000).toFixed(1)}s</>
              )}
            </>
          )}
        </div>
      </div>

      {iteration.reasoning && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Reasoning ({iteration.reasoning.length.toLocaleString()} chars)
          </summary>
          <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-neutral-50 p-3 font-mono text-xs leading-relaxed text-neutral-700 dark:bg-neutral-950/50 dark:text-neutral-300">
            {iteration.reasoning}
          </pre>
        </details>
      )}

      {iteration.content && (
        <details className="mt-2" open>
          <summary className="cursor-pointer text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Content ({iteration.content.length.toLocaleString()} chars)
          </summary>
          <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-200">
            {iteration.content}
          </pre>
        </details>
      )}

      {iteration.toolCalls.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Tool calls ({iteration.toolCalls.length})
          </p>
          {iteration.toolCalls.map((tc) => (
            <ToolCallRow key={tc.id} entry={tc} />
          ))}
        </div>
      )}

      {iteration.capturedPrompt && iteration.capturedPrompt.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Captured prompt ({iteration.capturedPrompt.length} message
            {iteration.capturedPrompt.length === 1 ? "" : "s"})
          </summary>
          <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-neutral-50 p-3 font-mono text-xs leading-relaxed text-neutral-700 dark:bg-neutral-950/50 dark:text-neutral-300">
            {JSON.stringify(iteration.capturedPrompt, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function ToolCallRow({ entry }: { entry: ToolCallEntry }) {
  return (
    <details className="rounded border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/30">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs">
        <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
          {entry.displayName}
        </span>
        <Badge
          label={entry.status}
          className={TOOL_STATUS_STYLES[entry.status]}
        />
        {entry.result && !entry.result.success && (
          <span className="truncate text-red-600 dark:text-red-400">
            {entry.result.message}
          </span>
        )}
      </summary>
      <div className="space-y-2 border-t border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <div>
          <p className="text-[10px] uppercase text-neutral-500 dark:text-neutral-400">
            Input
          </p>
          <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2 font-mono text-[11px] dark:bg-neutral-900">
            {JSON.stringify(entry.input, null, 2)}
          </pre>
        </div>
        {entry.result && (
          <div>
            <p className="text-[10px] uppercase text-neutral-500 dark:text-neutral-400">
              Result
            </p>
            <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2 font-mono text-[11px] dark:bg-neutral-900">
              {JSON.stringify(entry.result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}
