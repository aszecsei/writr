"use client";

import { BookMarked, Sparkles, Trash2 } from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { getAppSettings } from "@/db/operations";
import { getAgent } from "@/db/operations/agents";
import type { AgentDefinitionId } from "@/db/schemas";
import {
  useCharactersByProject,
  useLocationsByProject,
  useRelationshipsByProject,
  useStyleGuideByProject,
  useTimelineByProject,
  useWorldbuildingDocsByProject,
} from "@/hooks/data/useBibleEntries";
import { useChapter, useManuscriptChapters } from "@/hooks/data/useChapter";
import { useLoreRetrieval } from "@/hooks/data/useLoreRetrieval";
import { useProject } from "@/hooks/data/useProject";
import { useAvailableSavedPrompts } from "@/hooks/data/useSavedPrompts";
import {
  useOutlineGridCells,
  useOutlineGridColumns,
  useOutlineGridRows,
} from "@/hooks/outline/useOutlineGrid";
import {
  type Agent,
  makeChatAgent,
  resolveAgentModel,
  runAgent,
} from "@/lib/ai/agents";
import { getAgentBehavior } from "@/lib/ai/agents/builtins/defaults";
import { PROVIDERS } from "@/lib/ai/providers";
import type { AiContext, AiMessage } from "@/lib/ai/types";
import type { RetrievalResult } from "@/lib/retrieval/types";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";
import { AgentSelector } from "./AgentSelector";
import { makeUserMessage } from "./chat/factories";
import { makeAiPanelAccessor } from "./chat/panelAccessor";
import type { ChatMessage, ChatMessageId } from "./chat/types";
import { ImageAttachmentPicker } from "./ImageAttachmentPicker";
import { MessageList } from "./MessageList";
import type { PendingImage } from "./PromptInput";
import { PromptInput } from "./PromptInput";
import { PromptInspectorDialog } from "./PromptInspectorDialog";

export function AiPanel() {
  const projectId = useProjectStore((s) => s.activeProjectId);
  const project = useProject(projectId);
  const openModal = useUiStore((s) => s.openModal);
  const savedPrompts = useAvailableSavedPrompts(projectId);
  const characters = useCharactersByProject(projectId);
  const locations = useLocationsByProject(projectId);
  const styleGuide = useStyleGuideByProject(projectId);
  const timelineEvents = useTimelineByProject(projectId);
  const worldbuildingDocs = useWorldbuildingDocsByProject(projectId);
  const relationships = useRelationshipsByProject(projectId);
  const outlineGridColumns = useOutlineGridColumns(projectId);
  const outlineGridRows = useOutlineGridRows(projectId);
  const outlineGridCells = useOutlineGridCells(projectId);
  const chapters = useManuscriptChapters(projectId);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const activeDocumentType = useEditorStore((s) => s.activeDocumentType);
  const selectedText = useEditorStore((s) => s.selectedText);
  const selectedRange = useEditorStore((s) => s.selectedRange);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const activeChapter = useChapter(
    activeDocumentType === "chapter" ? activeDocumentId : null,
  );
  const retrieve = useLoreRetrieval(projectId);

  const [selectedAgentId, setSelectedAgentId] =
    useState<AgentDefinitionId | null>(null);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectingPrompt, setInspectingPrompt] = useState<AiMessage[] | null>(
    null,
  );
  const requestStartRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [editingMessageId, setEditingMessageId] =
    useState<ChatMessageId | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [pendingToolApproval, setPendingToolApproval] = useState(false);

  // Mirror `messages` into a ref so the accessor's `getMessages()` can read
  // the freshest snapshot regardless of React batching. The accessor is
  // built once per `runAgent` call (closing over this ref + the spark
  // overlay) and torn down when the run completes.
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Per-tool approval gate. Maps a pending tool message's id to the resolver
  // for its approval promise. The Approve/Deny buttons in MessageList look
  // up the entry by tool message id and resolve it.
  const toolApprovalResolversRef = useRef<
    Map<ChatMessageId, (approved: boolean) => void>
  >(new Map());

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
      currentChapterId: activeChapter?.id,
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

  function awaitToolApproval(toolMessageId: ChatMessageId): Promise<boolean> {
    setPendingToolApproval(true);
    return new Promise<boolean>((resolve) => {
      toolApprovalResolversRef.current.set(toolMessageId, resolve);
    });
  }

  function resolveToolApproval(
    toolMessageId: ChatMessageId,
    approved: boolean,
  ) {
    const resolver = toolApprovalResolversRef.current.get(toolMessageId);
    if (resolver) {
      toolApprovalResolversRef.current.delete(toolMessageId);
      resolver(approved);
    }
    if (toolApprovalResolversRef.current.size === 0) {
      setPendingToolApproval(false);
    }
  }

  function handleApproveToolCall(toolMessageId: ChatMessageId) {
    resolveToolApproval(toolMessageId, true);
  }

  function handleDenyToolCall(toolMessageId: ChatMessageId) {
    resolveToolApproval(toolMessageId, false);
  }

  /**
   * Run the selected agent against the current chat history. The user
   * message must already have been appended via `setMessages` before this
   * is called — the accessor reads from `messagesRef` to assemble the API
   * request, so the user turn is already there.
   */
  async function runSelectedAgent(signal: AbortSignal): Promise<void> {
    if (!selectedAgentId) {
      throw new Error("No agent selected.");
    }
    if (!projectId) {
      throw new Error("No active project.");
    }
    const definition = await getAgent(selectedAgentId);
    if (!definition) {
      throw new Error("Selected agent no longer exists.");
    }

    const settings = await getAppSettings();
    const baseContext = buildContext();

    let retrieval: RetrievalResult | null = null;
    try {
      retrieval = activeChapter ? await retrieve(activeChapter) : null;
    } catch (err) {
      console.error("Lore retrieval failed; sending without it.", err);
    }

    const context = {
      ...baseContext,
      relevantLore: retrieval?.lore.map((h) => ({
        title: h.title,
        text: h.text,
      })),
      pastEvents: retrieval?.pastEvents.map((h) => ({
        title: h.title,
        text: h.text,
      })),
      futureEvents: retrieval?.futureEvents.map((h) => ({
        title: h.title,
        text: h.text,
      })),
    };

    // Capture the editor selection at submit time so a Spark option insert
    // later replaces what the user had highlighted, even if they click
    // around. Plain chat agents ignore this.
    const capturedRange = selectedRange
      ? { from: selectedRange.from, to: selectedRange.to }
      : null;

    const behavior = getAgentBehavior(definition.kind);
    const isSpark = behavior === "spark";
    const isPanel = behavior === "panel";

    const agent: Agent = makeChatAgent({
      definition,
      projectId,
      context,
      customSystemPrompt: settings.customSystemPrompt,
      postChatInstructions: settings.postChatInstructions,
      postChatInstructionsDepth: settings.postChatInstructionsDepth,
    });

    const model = resolveAgentModel(agent, settings);
    if (!model.apiKey) {
      throw new Error(
        `No API key configured. Add your ${PROVIDERS[model.provider].label} API key in App Settings.`,
      );
    }

    requestStartRef.current = Date.now();
    setElapsedMs(0);

    const accessor = makeAiPanelAccessor({
      messagesRef,
      setMessages,
      spark: { isSpark, capturedRange },
      panel: { isPanel },
      awaitToolApproval,
    });

    await runAgent({
      agent,
      model,
      history: accessor,
      // Spark needs the full response in one shot to parse options reliably.
      stream: isSpark ? false : settings.streamResponses,
      signal,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!prompt.trim() && pendingImages.length === 0) || loading) return;

    const userText = prompt.trim();
    const attachedImages =
      pendingImages.length > 0 ? [...pendingImages] : undefined;
    setPrompt("");
    setPendingImages([]);

    const newUserMsg = makeUserMessage({
      content: userText,
      selectedText: selectedText || undefined,
      selectedChapterId: selectedText ? activeChapter?.id : undefined,
      images: attachedImages?.map((img) => ({ url: img.url, alt: img.alt })),
    });
    setMessages((prev) => [...prev, newUserMsg]);
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await runSelectedAgent(controller.signal);

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
    // Resolve any pending tool-call approvals as denied so the runner can
    // unwind cleanly. The runner's own abort check then bails out before
    // executing the tool.
    for (const resolver of toolApprovalResolversRef.current.values()) {
      resolver(false);
    }
    toolApprovalResolversRef.current.clear();
    setMessages((prev) => {
      // Drop a trailing assistant turn that hasn't been finalized
      // (no durationMs => still in-progress).
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

  function handleDeleteMessage(_id: ChatMessageId, index: number) {
    setMessages((prev) => prev.slice(0, index));
  }

  function handleEditMessage(id: ChatMessageId) {
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
    const newUserMsg = makeUserMessage({
      content: editingContent.trim(),
    });

    setMessages([...historyBeforeEdit, newUserMsg]);
    setEditingMessageId(null);
    setEditingContent("");
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await runSelectedAgent(controller.signal);
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

  async function handleRegenerate(id: ChatMessageId) {
    const msgIndex = messages.findIndex((m) => m.id === id);
    if (msgIndex === -1 || msgIndex === 0) return;

    // Walk back past any tool messages that belong to the assistant turn
    // we're regenerating, then truncate at the assistant message itself.
    let truncateAt = msgIndex;
    while (truncateAt > 0 && messages[truncateAt - 1].role === "tool") {
      truncateAt -= 1;
    }
    // The previous user turn must immediately precede the assistant turn
    // (after stripping any preceding tool messages).
    const prev = messages[truncateAt - 1];
    if (prev?.role !== "user") return;

    setMessages(messages.slice(0, truncateAt));
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await runSelectedAgent(controller.signal);
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
    const newUserMsg = makeUserMessage({ content: continuePrompt });

    setMessages((prev) => [...prev, newUserMsg]);
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await runSelectedAgent(controller.signal);
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openModal({ id: "saved-prompts" })}
              title="Saved prompts"
              className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <BookMarked size={14} />
            </button>
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
        savedPrompts={savedPrompts ?? []}
        onSelectPrompt={(body) => setPrompt(body)}
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
