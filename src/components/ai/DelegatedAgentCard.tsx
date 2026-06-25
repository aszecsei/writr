"use client";

import { AlertCircle, Bot, ChevronRight, Loader2 } from "lucide-react";
import type { ToolChatMessage } from "./chat/types";

interface DelegatedAgentCardProps {
  message: ToolChatMessage;
  /** Drill into this sub-agent's nested transcript. */
  onEnter?: () => void;
  /** True while the sub-agent run is still streaming (tool not yet terminal). */
  running?: boolean;
}

/**
 * Renders a `delegate` tool call as a compact sub-agent card: the resolved
 * agent name, run status, a one-line answer preview, and an "Enter" affordance
 * to drill into the sub-agent's nested transcript.
 */
export function DelegatedAgentCard({
  message,
  onEnter,
  running,
}: DelegatedAgentCardProps) {
  const agentName =
    message.nestedAgentName ??
    (typeof message.input.agent === "string"
      ? message.input.agent
      : "sub-agent");
  const prompt =
    typeof message.input.prompt === "string" ? message.input.prompt : "";
  const answer =
    typeof message.result?.data?.answer === "string"
      ? (message.result.data.answer as string)
      : (message.result?.message ?? "");
  const isError =
    message.status === "error" || message.result?.success === false;
  const hasNested =
    !!message.nestedMessages && message.nestedMessages.length > 0;

  return (
    <button
      type="button"
      onClick={onEnter}
      disabled={!onEnter || !hasNested}
      className="my-2 block w-full rounded-md border border-primary-200 bg-primary-50/50 text-left transition-colors hover:bg-primary-50 disabled:cursor-default disabled:hover:bg-primary-50/50 dark:border-primary-900/50 dark:bg-primary-950/30 dark:hover:bg-primary-950/50"
    >
      <div className="flex items-center gap-2 border-b border-primary-200 px-3 py-1.5 dark:border-primary-900/50">
        <Bot
          size={13}
          className="shrink-0 text-primary-600 dark:text-primary-400"
        />
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
          Delegated to {agentName}
        </span>
        {running ? (
          <Loader2 size={12} className="animate-spin text-neutral-400" />
        ) : isError ? (
          <AlertCircle size={12} className="text-red-500" />
        ) : null}
        {hasNested && onEnter && (
          <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-600 dark:text-primary-400">
            Enter
            <ChevronRight size={12} />
          </span>
        )}
      </div>
      {prompt && (
        <div className="px-3 py-1 text-xs italic text-neutral-500 dark:text-neutral-400">
          “{prompt.length > 140 ? `${prompt.slice(0, 140)}…` : prompt}”
        </div>
      )}
      {answer && (
        <div
          className={`px-3 py-1.5 text-xs ${
            isError
              ? "text-red-600 dark:text-red-400"
              : "text-neutral-700 dark:text-neutral-300"
          }`}
        >
          {answer.length > 220 ? `${answer.slice(0, 220)}…` : answer}
        </div>
      )}
    </button>
  );
}
