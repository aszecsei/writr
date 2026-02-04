"use client";

import { AlertCircle, ArrowUp, Code, Sparkles, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { getAppSettings } from "@/db/operations";
import {
  useCharactersByProject,
  useLocationsByProject,
  useRelationshipsByProject,
  useStyleGuideByProject,
  useTimelineByProject,
  useWorldbuildingDocsByProject,
} from "@/hooks/useBibleEntries";
import { useChapter, useChaptersByProject } from "@/hooks/useChapter";
import {
  useOutlineGridCells,
  useOutlineGridColumns,
  useOutlineGridRows,
} from "@/hooks/useOutlineGrid";
import { useProject } from "@/hooks/useProject";
import { callAi, streamAi } from "@/lib/ai/client";
import { buildMessages } from "@/lib/ai/prompts";
import type { AiContext, AiMessage, AiTool } from "@/lib/ai/types";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { MarkdownMessage } from "./MarkdownMessage";
import { PromptInspectorDialog } from "./PromptInspectorDialog";

const AI_TOOLS: { id: AiTool; label: string }[] = [
  { id: "generate-prose", label: "Generate Prose" },
  { id: "review-text", label: "Review Text" },
  { id: "suggest-edits", label: "Suggest Edits" },
  { id: "character-dialogue", label: "Character Dialogue" },
  { id: "brainstorm", label: "Brainstorm" },
  { id: "summarize", label: "Summarize" },
  { id: "consistency-check", label: "Consistency Check" },
];

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

export function AiPanel() {
  const projectId = useProjectStore((s) => s.activeProjectId);
  const project = useProject(projectId);
  const characters = useCharactersByProject(projectId);
  const locations = useLocationsByProject(projectId);
  const styleGuide = useStyleGuideByProject(projectId);
  const timelineEvents = useTimelineByProject(projectId);
  const worldbuildingDocs = useWorldbuildingDocsByProject(projectId);
  const relationships = useRelationshipsByProject(projectId);
  const outlineGridColumns = useOutlineGridColumns(projectId);
  const outlineGridRows = useOutlineGridRows(projectId);
  const outlineGridCells = useOutlineGridCells(projectId);
  const chapters = useChaptersByProject(projectId);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const activeDocumentType = useEditorStore((s) => s.activeDocumentType);
  const activeChapter = useChapter(
    activeDocumentType === "chapter" ? activeDocumentId : null,
  );

  const [tool, setTool] = useState<AiTool>("generate-prose");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectingPrompt, setInspectingPrompt] = useState<AiMessage[] | null>(
    null,
  );
  const requestStartRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!loading) {
      requestStartRef.current = null;
      return;
    }
    const interval = setInterval(() => {
      if (requestStartRef.current != null) {
        setElapsedMs(Date.now() - requestStartRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userMessage = prompt.trim();
    setPrompt("");
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      },
    ]);
    setLoading(true);
    setError(null);

    try {
      const settings = await getAppSettings();

      const context: AiContext = {
        projectTitle: project?.title ?? "",
        genre: project?.genre ?? "",
        characters: characters ?? [],
        locations: locations ?? [],
        styleGuide: styleGuide ?? [],
        timelineEvents: timelineEvents ?? [],
        worldbuildingDocs: worldbuildingDocs ?? [],
        relationships: relationships ?? [],
        outlineGridColumns: outlineGridColumns ?? [],
        outlineGridRows: outlineGridRows ?? [],
        outlineGridCells: outlineGridCells ?? [],
        chapters: chapters ?? [],
        currentChapterTitle: activeChapter?.title,
        currentChapterContent: activeChapter?.content || undefined,
      };

      const history: AiMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      if (settings.debugMode) {
        const debugMessages = buildMessages(
          tool,
          userMessage,
          context,
          history,
        );
        const formatted = debugMessages
          .map((m) => {
            const text =
              typeof m.content === "string"
                ? m.content
                : m.content.map((p) => p.text).join("");
            return `--- [${m.role.toUpperCase()}] ---\n${text}`;
          })
          .join("\n\n");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `[DRY-RUN] Prompt that would be sent to ${settings.preferredModel}:\n\n${formatted}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        if (!settings.openRouterApiKey) {
          throw new Error(
            "No API key configured. Add your OpenRouter API key in App Settings.",
          );
        }

        const aiSettings = {
          apiKey: settings.openRouterApiKey,
          model: settings.preferredModel,
          reasoningEffort: settings.reasoningEffort,
        };

        const capturedPrompt = buildMessages(
          tool,
          userMessage,
          context,
          history,
        );

        const startTime = Date.now();
        requestStartRef.current = startTime;
        setElapsedMs(0);

        if (settings.streamResponses) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "",
              timestamp: new Date().toISOString(),
              promptMessages: capturedPrompt,
            },
          ]);

          for await (const chunk of streamAi(
            tool,
            userMessage,
            context,
            aiSettings,
            history,
          )) {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (chunk.type === "reasoning") {
                updated[updated.length - 1] = {
                  ...last,
                  reasoning: (last.reasoning ?? "") + chunk.text,
                };
              } else {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + chunk.text,
                };
              }
              return updated;
            });
          }

          const elapsed = Date.now() - startTime;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = { ...last, durationMs: elapsed };
            return updated;
          });
        } else {
          const response = await callAi(
            tool,
            userMessage,
            context,
            aiSettings,
            history,
          );

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: response.content,
              reasoning: response.reasoning,
              timestamp: new Date().toISOString(),
              promptMessages: capturedPrompt,
              durationMs: Date.now() - startTime,
            },
          ]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="flex h-full flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Sparkles size={14} />
            AI Assistant
          </h3>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              title="Clear conversation"
              className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <select
          value={tool}
          onChange={(e) => setTool(e.target.value as AiTool)}
          className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {AI_TOOLS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

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
                  onClick={() =>
                    setInspectingPrompt(msg.promptMessages ?? null)
                  }
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

      <form
        onSubmit={handleSubmit}
        className="border-t border-zinc-200 p-3 dark:border-zinc-800"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask the AI..."
            disabled={loading}
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            title="Send message"
            className="rounded-md bg-zinc-900 p-2 text-white transition-all duration-150 hover:bg-zinc-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </form>
      {inspectingPrompt && (
        <PromptInspectorDialog
          promptMessages={inspectingPrompt}
          onClose={() => setInspectingPrompt(null)}
        />
      )}
    </aside>
  );
}
