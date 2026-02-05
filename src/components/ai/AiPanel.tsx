"use client";

import { Sparkles, Trash2 } from "lucide-react";
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
import type {
  AiContext,
  AiMessage,
  AiTool,
  ReasoningEffort,
} from "@/lib/ai/types";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import type { Message } from "./MessageList";
import { MessageList } from "./MessageList";
import { PromptInput } from "./PromptInput";
import { PromptInspectorDialog } from "./PromptInspectorDialog";
import { ToolSelector } from "./ToolSelector";

function formatDebugMessages(messages: AiMessage[], model: string): string {
  const formatted = messages
    .map((m) => {
      const text =
        typeof m.content === "string"
          ? m.content
          : m.content.map((p) => p.text).join("");
      return `--- [${m.role.toUpperCase()}] ---\n${text}`;
    })
    .join("\n\n");
  return `[DRY-RUN] Prompt that would be sent to ${model}:\n\n${formatted}`;
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

  async function handleStreamResponse(
    userMessage: string,
    context: AiContext,
    aiSettings: {
      apiKey: string;
      model: string;
      reasoningEffort: ReasoningEffort;
    },
    history: AiMessage[],
    capturedPrompt: AiMessage[],
    startTime: number,
  ) {
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
  }

  async function handleNonStreamResponse(
    userMessage: string,
    context: AiContext,
    aiSettings: {
      apiKey: string;
      model: string;
      reasoningEffort: ReasoningEffort;
    },
    history: AiMessage[],
    capturedPrompt: AiMessage[],
    startTime: number,
  ) {
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
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: formatDebugMessages(
              debugMessages,
              settings.preferredModel,
            ),
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
          await handleStreamResponse(
            userMessage,
            context,
            aiSettings,
            history,
            capturedPrompt,
            startTime,
          );
        } else {
          await handleNonStreamResponse(
            userMessage,
            context,
            aiSettings,
            history,
            capturedPrompt,
            startTime,
          );
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
        <ToolSelector value={tool} onChange={setTool} />
      </div>

      <MessageList
        messages={messages}
        loading={loading}
        elapsedMs={elapsedMs}
        error={error}
        onInspectPrompt={setInspectingPrompt}
      />

      <PromptInput
        value={prompt}
        onChange={setPrompt}
        onSubmit={handleSubmit}
        loading={loading}
      />
      {inspectingPrompt && (
        <PromptInspectorDialog
          promptMessages={inspectingPrompt}
          onClose={() => setInspectingPrompt(null)}
        />
      )}
    </aside>
  );
}
