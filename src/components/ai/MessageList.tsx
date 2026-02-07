"use client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  Code,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import type { AiMessage } from "@/lib/ai/types";
import { MarkdownMessage } from "./MarkdownMessage";

interface Message {
  id: string;
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
  onDeleteMessage: (id: string, index: number) => void;
  onEditMessage: (id: string) => void;
  onRegenerate: (id: string) => void;
  onContinue: () => void;
  editingMessageId: string | null;
  editingContent: string;
  onEditingContentChange: (content: string) => void;
  onCancelEdit: () => void;
  onConfirmEdit: () => void;
}

export type { Message };

export function MessageList({
  messages,
  loading,
  elapsedMs,
  error,
  onInspectPrompt,
  onDeleteMessage,
  onEditMessage,
  onRegenerate,
  onContinue,
  editingMessageId,
  editingContent,
  onEditingContentChange,
  onCancelEdit,
  onConfirmEdit,
}: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 py-8">
          Choose a tool and describe what you need.
        </p>
      )}
      {messages.map((msg, i) => {
        const isEditing = editingMessageId === msg.id;

        return (
          <div
            key={msg.id}
            className={`group relative rounded-lg px-3 py-2 text-sm ${
              msg.role === "user"
                ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                : "border border-neutral-200 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
            }`}
          >
            <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
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
              <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {msg.role === "user" && !loading && (
                  <>
                    <button
                      type="button"
                      onClick={() => onEditMessage(msg.id)}
                      title="Edit message"
                      className="rounded p-0.5 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteMessage(msg.id, i)}
                      title="Delete message and responses after it"
                      className="rounded p-0.5 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
                {msg.role === "assistant" && !loading && (
                  <>
                    <button
                      type="button"
                      onClick={() => onRegenerate(msg.id)}
                      title="Regenerate response"
                      className="rounded p-0.5 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                    >
                      <RefreshCw size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteMessage(msg.id, i)}
                      title="Delete message and responses after it"
                      className="rounded p-0.5 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
                {msg.role === "assistant" && msg.promptMessages && (
                  <button
                    type="button"
                    onClick={() => onInspectPrompt(msg.promptMessages ?? [])}
                    title="Inspect prompt"
                    className="rounded p-0.5 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                  >
                    <Code size={12} />
                  </button>
                )}
              </div>
            </div>
            {msg.role === "assistant" && msg.reasoning && (
              <details className="mb-2 rounded border border-neutral-200 dark:border-neutral-700">
                <summary className="cursor-pointer select-none px-2 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Reasoning
                </summary>
                <div className="px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">
                  {msg.reasoning}
                </div>
              </details>
            )}
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editingContent}
                  onChange={(e) => onEditingContentChange(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
                  >
                    <X size={12} />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onConfirmEdit}
                    disabled={!editingContent.trim()}
                    className="flex items-center gap-1 rounded-md bg-primary-600 px-2 py-1 text-xs text-white transition-colors hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
                  >
                    <Check size={12} />
                    Resend
                  </button>
                </div>
              </div>
            ) : msg.role === "assistant" ? (
              <MarkdownMessage content={msg.content} />
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>
        );
      })}
      {!loading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === "assistant" && (
          <button
            type="button"
            onClick={onContinue}
            className="mx-auto flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            <ArrowRight size={12} />
            Continue
          </button>
        )}
      {loading && (
        <div className="flex justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600 dark:border-neutral-700 dark:border-t-primary-400" />
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
