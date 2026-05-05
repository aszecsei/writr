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
import { getAgent } from "@/db/operations/agents";
import {
  useCharactersByProject,
  useLocationsByProject,
  useRelationshipsByProject,
  useStyleGuideByProject,
  useTimelineByProject,
  useWorldbuildingDocsByProject,
} from "@/hooks/data/useBibleEntries";
import { useChapter, useChaptersByProject } from "@/hooks/data/useChapter";
import { useProject } from "@/hooks/data/useProject";
import {
  useOutlineGridCells,
  useOutlineGridColumns,
  useOutlineGridRows,
} from "@/hooks/outline/useOutlineGrid";
import {
  type Agent,
  makeChatAgent,
  type RunAgentCallbacks,
  resolveAgentModel,
  runAgent,
} from "@/lib/ai/agents";
import { getAgentBehavior } from "@/lib/ai/agents/builtins/defaults";
import { PROVIDERS } from "@/lib/ai/providers";
import type { AiContext, AiMessage } from "@/lib/ai/types";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { AgentSelector } from "./AgentSelector";
import { ImageAttachmentPicker } from "./ImageAttachmentPicker";
import type { Message } from "./MessageList";
import { MessageList } from "./MessageList";
import type { PendingImage } from "./PromptInput";
import { PromptInput } from "./PromptInput";
import { PromptInspectorDialog } from "./PromptInspectorDialog";

/** Convert UI Message[] to AiMessage[] for the API, including tool call history */
function messagesToAiHistory(messages: Message[]): AiMessage[] {
  const result: AiMessage[] = [];

  for (const m of messages) {
    if (m.images && m.images.length > 0) {
      result.push({
        role: m.role,
        content: [
          { type: "text" as const, text: m.content },
          ...m.images.map((img) => ({
            type: "image_url" as const,
            image_url: { url: img.url },
          })),
        ],
      });
    } else {
      const msg: AiMessage = { role: m.role, content: m.content };

      if (m.toolCalls?.length) {
        msg.toolCalls = m.toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.toolName,
          arguments: tc.input,
        }));
      }

      result.push(msg);
    }

    if (m.toolCalls?.length) {
      for (const tc of m.toolCalls) {
        if (
          tc.status === "executed" ||
          tc.status === "denied" ||
          tc.status === "error"
        ) {
          const content =
            tc.status === "denied"
              ? JSON.stringify({ success: false, message: "Denied by user" })
              : JSON.stringify(
                  tc.result ?? { success: false, message: "No result" },
                );
          result.push({
            role: "tool",
            content,
            toolCallId: tc.id,
          });
        }
      }
    }
  }

  return result;
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
  const selectedRange = useEditorStore((s) => s.selectedRange);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const activeChapter = useChapter(
    activeDocumentType === "chapter" ? activeDocumentId : null,
  );

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
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
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [pendingToolApproval, setPendingToolApproval] = useState(false);

  // Resolver for pending tool call approval — settled by Approve/Deny buttons
  const toolCallResolverRef = useRef<{
    resolve: (approved: boolean) => void;
  } | null>(null);

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

  const activeProjectMode = useProjectStore((s) => s.activeProjectMode);

  const buildContext = useCallback((): AiContext => {
    return {
      projectTitle: project?.title ?? "",
      projectDescription: project?.description ?? "",
      genre: project?.genre ?? "",
      projectMode: activeProjectMode ?? "prose",
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
    activeProjectMode,
  ]);

  function waitForToolDecision(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      toolCallResolverRef.current = { resolve };
    });
  }

  function handleApproveToolCall(messageId: string, toolCallId: string) {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              toolCalls: msg.toolCalls?.map((tc) =>
                tc.id === toolCallId
                  ? { ...tc, status: "approved" as const }
                  : tc,
              ),
            }
          : msg,
      ),
    );
    toolCallResolverRef.current?.resolve(true);
    toolCallResolverRef.current = null;
  }

  function handleDenyToolCall(messageId: string, toolCallId: string) {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              toolCalls: msg.toolCalls?.map((tc) =>
                tc.id === toolCallId
                  ? { ...tc, status: "denied" as const }
                  : tc,
              ),
            }
          : msg,
      ),
    );
    toolCallResolverRef.current?.resolve(false);
    toolCallResolverRef.current = null;
  }

  async function generateAiResponse(
    userMessage: string,
    history: Message[],
    signal: AbortSignal,
    images?: PendingImage[],
  ) {
    if (!selectedAgentId) {
      throw new Error("No agent selected.");
    }
    const definition = await getAgent(selectedAgentId);
    if (!definition) {
      throw new Error("Selected agent no longer exists.");
    }

    const settings = await getAppSettings();
    const context = buildContext();

    const aiHistory = messagesToAiHistory(history);
    const imageAttachments = images?.map((img) => ({ url: img.url }));

    // Capture the editor selection at submit time so an option insert later
    // replaces what the user had highlighted, even if they click around.
    const capturedRange = selectedRange
      ? { from: selectedRange.from, to: selectedRange.to }
      : null;

    const behavior = getAgentBehavior(definition.kind);
    const isSpark = behavior === "spark";

    const agent: Agent = makeChatAgent({
      definition,
      projectId: projectId ?? "",
      context,
      customSystemPrompt: settings.customSystemPrompt,
      postChatInstructions: settings.postChatInstructions,
      postChatInstructionsDepth: settings.postChatInstructionsDepth,
      images: imageAttachments,
    });

    const model = resolveAgentModel(agent, settings);
    if (!model.apiKey) {
      throw new Error(
        `No API key configured. Add your ${PROVIDERS[model.provider].label} API key in App Settings.`,
      );
    }

    requestStartRef.current = Date.now();
    setElapsedMs(0);

    const callbacks: RunAgentCallbacks = {
      onIterationStart: ({ messageId, iteration, capturedPrompt }) => {
        setMessages((prev) => [
          ...prev,
          {
            id: messageId,
            role: "assistant",
            content: "",
            timestamp: new Date().toISOString(),
            promptMessages: iteration === 1 ? capturedPrompt : undefined,
          },
        ]);
      },
      onChunk: ({ messageId, chunk }) => {
        if (chunk.type !== "content" && chunk.type !== "reasoning") return;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            if (chunk.type === "reasoning") {
              return { ...m, reasoning: (m.reasoning ?? "") + chunk.text };
            }
            return { ...m, content: m.content + chunk.text };
          }),
        );
      },
      onIterationEnd: ({
        messageId,
        content,
        reasoning,
        finishReason,
        durationMs,
      }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content,
                  reasoning: reasoning ?? m.reasoning,
                  finishReason,
                  durationMs,
                  // Mark spark messages so MessageList renders option cards.
                  sparkOptions: isSpark ? true : m.sparkOptions,
                  sparkCapturedRange: isSpark ? capturedRange : undefined,
                }
              : m,
          ),
        );
      },
      onToolCallsCollected: ({ messageId, entries }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, toolCalls: entries } : m,
          ),
        );
      },
      approveToolCall: async () => {
        setPendingToolApproval(true);
        try {
          const approved = await waitForToolDecision();
          return approved;
        } finally {
          setPendingToolApproval(false);
        }
      },
      onToolCallUpdate: ({ messageId, entry }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  toolCalls: m.toolCalls?.map((tc) =>
                    tc.id === entry.id ? entry : tc,
                  ),
                }
              : m,
          ),
        );
      },
    };

    await runAgent({
      agent,
      userInput: userMessage,
      history: aiHistory,
      model,
      // Spark needs the full response in one shot to parse options reliably.
      stream: isSpark ? false : settings.streamResponses,
      signal,
      ...callbacks,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!prompt.trim() && pendingImages.length === 0) || loading) return;

    const userMessage = prompt.trim();
    const attachedImages =
      pendingImages.length > 0 ? [...pendingImages] : undefined;
    setPrompt("");
    setPendingImages([]);

    const userMsgId = generateId();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
        images: attachedImages,
      },
    ]);
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const history = messages;
      await generateAiResponse(
        userMessage,
        history,
        controller.signal,
        attachedImages,
      );

      if (selectedText) {
        clearSelection();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
      setPendingToolApproval(false);
      abortControllerRef.current = null;
    }
  }

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (toolCallResolverRef.current) {
      toolCallResolverRef.current.resolve(false);
      toolCallResolverRef.current = null;
    }
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && last.durationMs == null) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    setLoading(false);
    setPendingToolApproval(false);
    setError(null);
  }

  function handleDeleteMessage(_id: string, index: number) {
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
      setPendingToolApproval(false);
      abortControllerRef.current = null;
    }
  }

  async function handleRegenerate(id: string) {
    const msgIndex = messages.findIndex((m) => m.id === id);
    if (msgIndex === -1 || msgIndex === 0) return;

    const prevUserMsg = messages[msgIndex - 1];
    if (prevUserMsg.role !== "user") return;

    const historyBeforeAssistant = messages.slice(0, msgIndex);
    setMessages(historyBeforeAssistant);
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await generateAiResponse(
        prevUserMsg.content,
        historyBeforeAssistant.slice(0, -1),
        controller.signal,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
      setPendingToolApproval(false);
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
      setPendingToolApproval(false);
      abortControllerRef.current = null;
    }
  }

  return (
    <aside className="flex h-full flex-col border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
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
              className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <AgentSelector value={selectedAgentId} onChange={setSelectedAgentId} />
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
        onApproveToolCall={handleApproveToolCall}
        onDenyToolCall={handleDenyToolCall}
        pendingToolApproval={pendingToolApproval}
      />

      <PromptInput
        value={prompt}
        onChange={setPrompt}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        loading={loading}
        selectedText={selectedText}
        onClearSelection={clearSelection}
        pendingImages={pendingImages}
        onAddImage={(img) => setPendingImages((prev) => [...prev, img])}
        onRemoveImage={(i) =>
          setPendingImages((prev) => prev.filter((_, idx) => idx !== i))
        }
        onOpenImagePicker={() => setShowImagePicker(true)}
      />
      {showImagePicker && (
        <ImageAttachmentPicker
          characters={characters ?? []}
          locations={locations ?? []}
          onSelect={(img) => setPendingImages((prev) => [...prev, img])}
          onClose={() => setShowImagePicker(false)}
        />
      )}
      {inspectingPrompt && (
        <PromptInspectorDialog
          promptMessages={inspectingPrompt}
          onClose={() => setInspectingPrompt(null)}
        />
      )}
    </aside>
  );
}
