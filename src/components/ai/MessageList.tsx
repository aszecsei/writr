"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardCopy,
  Code,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import type { ToolCallEntry } from "@/lib/ai/tool-calling";
import type { AiMessage, FinishReason } from "@/lib/ai/types";
import { ImageLightbox } from "../bible/ImageLightbox";
import type {
  AssistantChatMessage,
  ChatMessage,
  ChatMessageId,
  ToolChatMessage,
  UserChatMessage,
} from "./chat/types";
import { MarkdownMessage } from "./MarkdownMessage";
import {
  ProposedEditCard,
  type ProposedEditChatPayload,
} from "./ProposedEditCard";
import { SparkOptions } from "./SparkOptions";
import { ToolCallMessage } from "./ToolCallMessage";

function getProposedEditChatPayload(
  m: ToolChatMessage,
): ProposedEditChatPayload | null {
  if (m.toolName !== "propose_edit") return null;
  const data = m.result?.data;
  if (!data || data.mode !== "chat") return null;
  return data as unknown as ProposedEditChatPayload;
}

function toolMessageToToolCallEntry(m: ToolChatMessage): ToolCallEntry {
  return {
    id: m.toolCallId,
    toolName: m.toolName,
    displayName: m.displayName,
    input: m.input,
    status: m.status,
    result: m.result,
  };
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

interface MessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  elapsedMs: number;
  error: string | null;
  onInspectPrompt: (messages: AiMessage[]) => void;
  onDeleteMessage: (id: ChatMessageId, index: number) => void;
  onEditMessage: (id: ChatMessageId) => void;
  onRegenerate: (id: ChatMessageId) => void;
  onContinue: () => void;
  editingMessageId: ChatMessageId | null;
  editingContent: string;
  onEditingContentChange: (content: string) => void;
  onCancelEdit: () => void;
  onConfirmEdit: () => void;
  onApproveToolCall?: (toolMessageId: ChatMessageId) => void;
  onDenyToolCall?: (toolMessageId: ChatMessageId) => void;
  pendingToolApproval?: boolean;
}

function StopReasonBanner({ reason }: { reason: FinishReason }) {
  // `tool_use` is a normal mid-iteration state — the runner continues the
  // loop after dispatching tools — so it must never render as an error.
  if (reason === "stop" || reason === "tool_use") return null;

  const message =
    reason === "length"
      ? "Response was truncated due to token limit."
      : reason === "content_filter"
        ? "Response was filtered by the model's content policy."
        : "Response ended with an unexpected stop reason.";

  return (
    <div className="mt-2 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function buildAssistantCopyText(
  msg: AssistantChatMessage,
  followingToolMessages: ToolChatMessage[],
): string {
  let text = msg.content;
  for (const tc of followingToolMessages) {
    text += `\n\n---\nTool: ${tc.displayName}`;
    const params = Object.entries(tc.input).filter(([k]) => k !== "id");
    if (params.length) {
      for (const [key, value] of params) {
        text += `\n${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`;
      }
    }
    if (tc.result) {
      text += `\nResult: ${tc.result.message}`;
    }
  }
  return text;
}

/**
 * Group flat ChatMessage[] into render units. Each user message renders on
 * its own; each assistant message gets a unit containing it plus any tool
 * messages that follow it (until the next user/assistant). Tool messages
 * with no preceding assistant (which shouldn't happen in practice) render
 * standalone for diagnostic legibility.
 */
function groupForRender(messages: ChatMessage[]): Array<
  | { kind: "user"; index: number; msg: UserChatMessage }
  | {
      kind: "assistant";
      index: number;
      msg: AssistantChatMessage;
      tools: { index: number; msg: ToolChatMessage }[];
    }
  | { kind: "orphanTool"; index: number; msg: ToolChatMessage }
> {
  const out: ReturnType<typeof groupForRender> = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "user") {
      out.push({ kind: "user", index: i, msg });
    } else if (msg.role === "assistant") {
      const tools: { index: number; msg: ToolChatMessage }[] = [];
      let j = i + 1;
      while (j < messages.length && messages[j].role === "tool") {
        tools.push({ index: j, msg: messages[j] as ToolChatMessage });
        j += 1;
      }
      out.push({ kind: "assistant", index: i, msg, tools });
      i = j - 1;
    } else {
      out.push({ kind: "orphanTool", index: i, msg });
    }
  }
  return out;
}

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
  onApproveToolCall,
  onDenyToolCall,
  pendingToolApproval,
}: MessageListProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<ChatMessageId | null>(null);

  const groups = groupForRender(messages);
  const lastNonToolGroup =
    [...groups]
      .reverse()
      .find((g) => g.kind === "user" || g.kind === "assistant") ?? null;
  const showContinueButton =
    !loading &&
    !pendingToolApproval &&
    lastNonToolGroup?.kind === "assistant" &&
    lastNonToolGroup.msg.durationMs != null;
  const lastAssistantWasTruncated =
    showContinueButton &&
    lastNonToolGroup?.kind === "assistant" &&
    lastNonToolGroup.msg.finishReason === "length";

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 py-8">
          Choose an agent and describe what you need.
        </p>
      )}

      {groups.map((group) => {
        if (group.kind === "user") {
          const msg = group.msg;
          const isEditing = editingMessageId === msg.id;
          return (
            <div
              key={msg.id}
              className="group relative rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="font-medium">User</span>
                <span>
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!loading && (
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
                        onClick={() => onDeleteMessage(msg.id, group.index)}
                        title="Delete message and responses after it"
                        className="rounded p-0.5 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content);
                      setCopiedId(msg.id);
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    title="Copy to clipboard"
                    className="rounded p-0.5 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                  >
                    {copiedId === msg.id ? (
                      <Check size={12} />
                    ) : (
                      <ClipboardCopy size={12} />
                    )}
                  </button>
                </div>
              </div>
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
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.images && msg.images.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.images.map((img) => (
                        <button
                          key={img.url}
                          type="button"
                          onClick={() => setLightboxUrl(img.url)}
                          className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700"
                        >
                          {/* biome-ignore lint/performance/noImgElement: external/base64 URLs */}
                          <img
                            src={img.url}
                            alt={img.alt ?? "Attached image"}
                            className="h-20 w-20 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        }

        if (group.kind === "assistant") {
          const { msg, index, tools } = group;
          const isInFlight =
            loading && msg.durationMs == null && index === messages.length - 1;
          const ms = isInFlight ? elapsedMs : msg.durationMs;
          return (
            <div
              key={msg.id}
              className="group relative rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="font-medium">Assistant</span>
                <span>
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {ms != null && (
                  <span
                    title={
                      isInFlight ? undefined : `${(ms / 1000).toFixed(1)}s`
                    }
                  >
                    {formatDuration(ms)}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!loading && (
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
                        onClick={() => onDeleteMessage(msg.id, index)}
                        title="Delete message and responses after it"
                        className="rounded p-0.5 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                  {msg.capturedPrompt && (
                    <button
                      type="button"
                      onClick={() => onInspectPrompt(msg.capturedPrompt ?? [])}
                      title="Inspect prompt"
                      className="rounded p-0.5 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                    >
                      <Code size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const text = buildAssistantCopyText(
                        msg,
                        tools.map((t) => t.msg),
                      );
                      navigator.clipboard.writeText(text);
                      setCopiedId(msg.id);
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    title="Copy to clipboard"
                    className="rounded p-0.5 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                  >
                    {copiedId === msg.id ? (
                      <Check size={12} />
                    ) : (
                      <ClipboardCopy size={12} />
                    )}
                  </button>
                </div>
              </div>
              {msg.reasoning && (
                <details className="mb-2 rounded border border-neutral-200 dark:border-neutral-700">
                  <summary className="cursor-pointer select-none px-2 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Reasoning
                  </summary>
                  <div className="px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">
                    {msg.reasoning}
                  </div>
                </details>
              )}
              {msg.sparkOptions ? (
                <SparkOptions
                  content={msg.content}
                  capturedRange={msg.sparkCapturedRange ?? null}
                />
              ) : (
                <MarkdownMessage content={msg.content} />
              )}
              {tools.map(({ msg: tm }) => {
                const proposedEdit = getProposedEditChatPayload(tm);
                if (proposedEdit) {
                  return (
                    <ProposedEditCard key={tm.id} payload={proposedEdit} />
                  );
                }
                return (
                  <ToolCallMessage
                    key={tm.id}
                    entry={toolMessageToToolCallEntry(tm)}
                    onApprove={
                      tm.status === "pending" && onApproveToolCall
                        ? () => onApproveToolCall(tm.id)
                        : undefined
                    }
                    onDeny={
                      tm.status === "pending" && onDenyToolCall
                        ? () => onDenyToolCall(tm.id)
                        : undefined
                    }
                  />
                );
              })}
              {msg.finishReason && (
                <StopReasonBanner reason={msg.finishReason} />
              )}
            </div>
          );
        }

        // Defensive: a tool message without a preceding assistant. Shouldn't
        // happen in practice but render diagnostically rather than crashing.
        const tm = group.msg;
        return (
          <div
            key={tm.id}
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
          >
            Orphaned tool message: {tm.toolName}
          </div>
        );
      })}

      {showContinueButton && (
        <button
          type="button"
          onClick={onContinue}
          className={
            lastAssistantWasTruncated
              ? "mx-auto flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900"
              : "mx-auto flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
          }
        >
          <ArrowRight size={12} />
          {lastAssistantWasTruncated
            ? "Continue (response was truncated)"
            : "Continue"}
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
      {lightboxUrl && (
        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}
