"use client";

import { AlertCircle, Code } from "lucide-react";
import type { AiMessage } from "@/lib/ai/types";
import { MarkdownMessage } from "./MarkdownMessage";

interface Message {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  timestamp: string;
  promptMessages?: AiMessage[];
  durationMs?: number;
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  elapsedMs: number;
  error: string | null;
  onInspectPrompt: (messages: AiMessage[]) => void;
}

export type { Message };

export function MessageList({
  messages,
  loading,
  elapsedMs,
  error,
  onInspectPrompt,
}: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 py-8">
          Choose a tool and describe what you need.
        </p>
      )}
      {messages.map((msg, i) => (
        <div
          key={`${msg.role}-${i}`}
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.role === "user"
              ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              : "border border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          }`}
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-medium">
              {msg.role === "user" ? "User" : "Assistant"}
            </span>
            <span>
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {msg.role === "assistant" &&
              (() => {
                const isInFlight =
                  loading &&
                  msg.durationMs == null &&
                  i === messages.length - 1;
                const ms = isInFlight ? elapsedMs : msg.durationMs;
                if (ms == null) return null;
                return (
                  <span
                    title={
                      isInFlight ? undefined : `${(ms / 1000).toFixed(1)}s`
                    }
                  >
                    {formatDuration(ms)}
                  </span>
                );
              })()}
            {msg.role === "assistant" && msg.promptMessages && (
              <button
                type="button"
                onClick={() => onInspectPrompt(msg.promptMessages ?? [])}
                title="Inspect prompt"
                className="ml-auto rounded p-0.5 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
              >
                <Code size={12} />
              </button>
            )}
          </div>
          {msg.role === "assistant" && msg.reasoning && (
            <details className="mb-2 rounded border border-zinc-200 dark:border-zinc-700">
              <summary className="cursor-pointer select-none px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Reasoning
              </summary>
              <div className="px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                {msg.reasoning}
              </div>
            </details>
          )}
          {msg.role === "assistant" ? (
            <MarkdownMessage content={msg.content} />
          ) : (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          )}
        </div>
      ))}
      {loading && (
        <div className="flex justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
