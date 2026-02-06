"use client";

import { Sparkles, Trash2 } from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  const selectedText = useEditorStore((s) => s.selectedText);
  const clearSelection = useEditorStore((s) => s.clearSelection);
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

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

  const generateId = () => crypto.randomUUID();

  const buildContext = useCallback((): AiContext => {
    return {
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
      currentChapterContent: selectedText
        ? undefined
        : activeChapter?.content || undefined,
      selectedText: selectedText || undefined,
    };
  }, [
    project,
    characters,
    locations,
    styleGuide,
    timelineEvents,
    worldbuildingDocs,
    relationships,
    outlineGridColumns,
    outlineGridRows,
    outlineGridCells,
    chapters,
    activeChapter,
    selectedText,
  ]);

  async function generateAiResponse(
    userMessage: string,
    history: Message[],
    signal: AbortSignal,
  ) {
    const settings = await getAppSettings();
    const context = buildContext();

    const aiHistory: AiMessage[] = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (settings.debugMode) {
      const debugMessages = buildMessages(
        tool,
        userMessage,
        context,
        aiHistory,
      );
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: formatDebugMessages(debugMessages, settings.preferredModel),
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

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

    const capturedPrompt = buildMessages(tool, userMessage, context, aiHistory);
    const startTime = Date.now();
    requestStartRef.current = startTime;
    setElapsedMs(0);

    const assistantId = generateId();

    if (settings.streamResponses) {
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
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
        aiHistory,
        signal,
      )) {
        if (signal.aborted) break;
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
        aiHistory,
        signal,
      );

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userMessage = prompt.trim();
    setPrompt("");

    const userMsgId = generateId();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      },
    ]);
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Get current messages for history (before adding user message)
      const history = messages;
      await generateAiResponse(userMessage, history, controller.signal);

      // Selection is consumed once per submit
      if (selectedText) {
        clearSelection();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Request was cancelled, don't show error
        return;
      }
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Remove incomplete assistant message
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && last.durationMs == null) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    setLoading(false);
    setError(null);
  }

  function handleDeleteMessage(_id: string, index: number) {
    // Truncate conversation from that message
    setMessages((prev) => prev.slice(0, index));
  }

  function handleEditMessage(id: string) {
    const msg = messages.find((m) => m.id === id);
    if (msg && msg.role === "user") {
      setEditingMessageId(id);
      setEditingContent(msg.content);
    }
  }

  function handleCancelEdit() {
    setEditingMessageId(null);
    setEditingContent("");
  }

  async function handleConfirmEdit() {
    if (!editingContent.trim() || !editingMessageId) return;

    const msgIndex = messages.findIndex((m) => m.id === editingMessageId);
    if (msgIndex === -1) return;

    // Truncate from that message and add edited message
    const historyBeforeEdit = messages.slice(0, msgIndex);
    const userMsgId = generateId();
    const newUserMsg: Message = {
      id: userMsgId,
      role: "user",
      content: editingContent.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages([...historyBeforeEdit, newUserMsg]);
    setEditingMessageId(null);
    setEditingContent("");
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await generateAiResponse(
        editingContent.trim(),
        historyBeforeEdit,
        controller.signal,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }

  async function handleRegenerate(id: string) {
    const msgIndex = messages.findIndex((m) => m.id === id);
    if (msgIndex === -1 || msgIndex === 0) return;

    // Find the preceding user message
    const prevUserMsg = messages[msgIndex - 1];
    if (prevUserMsg.role !== "user") return;

    // Truncate from the assistant message
    const historyBeforeAssistant = messages.slice(0, msgIndex);
    setMessages(historyBeforeAssistant);
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await generateAiResponse(
        prevUserMsg.content,
        historyBeforeAssistant.slice(0, -1), // Exclude the user message from history
        controller.signal,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }

  async function handleContinue() {
    const continuePrompt = "Please continue from where you left off.";
    const userMsgId = generateId();

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: continuePrompt,
        timestamp: new Date().toISOString(),
      },
    ]);
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const history = messages;
      await generateAiResponse(continuePrompt, history, controller.signal);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
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
        onDeleteMessage={handleDeleteMessage}
        onEditMessage={handleEditMessage}
        onRegenerate={handleRegenerate}
        onContinue={handleContinue}
        editingMessageId={editingMessageId}
        editingContent={editingContent}
        onEditingContentChange={setEditingContent}
        onCancelEdit={handleCancelEdit}
        onConfirmEdit={handleConfirmEdit}
      />

      <PromptInput
        value={prompt}
        onChange={setPrompt}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        loading={loading}
        selectedText={selectedText}
        onClearSelection={clearSelection}
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
