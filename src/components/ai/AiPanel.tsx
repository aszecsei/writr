"use client";

import {
  BookMarked,
  ChevronLeft,
  Sparkles,
  Telescope,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAppSettings, isActiveInProject } from "@/db/operations";
import { getAgent } from "@/db/operations/agents";
import type { AgentDefinitionId, ChapterId } from "@/db/schemas";
import { useAgentRun } from "@/hooks/ai/useAgentRun";
import { useDelegationHost } from "@/hooks/ai/useDelegationHost";
import { usePendingGates } from "@/hooks/ai/usePendingGates";
import {
  useCharactersByProject,
  useGuardrailsByProject,
  useLocationsByProject,
  useStyleGuideByProject,
} from "@/hooks/data/useBibleEntries";
import { useChapter, useManuscriptChapters } from "@/hooks/data/useChapter";
import { useLoreRetrieval } from "@/hooks/data/useLoreRetrieval";
import { useProject } from "@/hooks/data/useProject";
import { useAvailableSavedPrompts } from "@/hooks/data/useSavedPrompts";
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
import type {
  ChatImage,
  ChatMessage,
  ChatMessageId,
  ToolChatMessage,
} from "./chat/types";
import { ImageAttachmentPicker } from "./ImageAttachmentPicker";
import { MessageList } from "./MessageList";
import { PendingGatesBar } from "./PendingGatesBar";
import { PromptInput } from "./PromptInput";
import { PromptInspectorDialog } from "./PromptInspectorDialog";
import { RetrievalPreviewDialog } from "./RetrievalPreviewDialog";

/**
 * Walk a drill path of delegate tool-message ids into the nested transcript it
 * points at. Returns the nested messages plus the sub-agent name labels for a
 * breadcrumb, or null if the path is stale (e.g. after a conversation reset).
 */
function resolveDrill(
  messages: ChatMessage[],
  path: ChatMessageId[],
): { nested: ChatMessage[]; labels: string[] } | null {
  let current = messages;
  const labels: string[] = [];
  for (const toolId of path) {
    const tool = current.find(
      (m): m is ToolChatMessage => m.role === "tool" && m.id === toolId,
    );
    if (!tool?.nestedMessages) return null;
    labels.push(
      tool.nestedAgentName ??
        (typeof tool.input.agent === "string" ? tool.input.agent : "sub-agent"),
    );
    current = tool.nestedMessages;
  }
  return { nested: current, labels };
}

export function AiPanel() {
  const projectId = useProjectStore((s) => s.activeProjectId);
  const project = useProject(projectId);
  const openModal = useUiStore((s) => s.openModal);
  const savedPrompts = useAvailableSavedPrompts(projectId);
  const characters = useCharactersByProject(projectId);
  const locations = useLocationsByProject(projectId);
  const styleGuide = useStyleGuideByProject(projectId);
  const guardrails = useGuardrailsByProject(projectId);
  const chapters = useManuscriptChapters(projectId);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const activeDocumentType = useEditorStore((s) => s.activeDocumentType);
  const selectedText = useEditorStore((s) => s.selectedText);
  const selectedRange = useEditorStore((s) => s.selectedRange);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const activeChapter = useChapter(
    activeDocumentType === "chapter" ? (activeDocumentId as ChapterId) : null,
  );
  const retrieve = useLoreRetrieval(projectId);

  const [selectedAgentId, setSelectedAgentId] =
    useState<AgentDefinitionId | null>(null);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inspectingPrompt, setInspectingPrompt] = useState<AiMessage[] | null>(
    null,
  );
  const [editingMessageId, setEditingMessageId] =
    useState<ChatMessageId | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [pendingImages, setPendingImages] = useState<ChatImage[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showRetrievalPreview, setShowRetrievalPreview] = useState(false);
  // Stack of delegate tool-message ids the user has drilled into. Empty =
  // viewing the top-level conversation.
  const [drillPath, setDrillPath] = useState<ChatMessageId[]>([]);

  const run = useAgentRun();
  const gates = usePendingGates();
  const { buildDelegationHost } = useDelegationHost({
    setMessages,
    pushGate: gates.pushGate,
  });

  // Mirror `messages` into a ref so the accessor's `getMessages()` can read
  // the freshest snapshot regardless of React batching. The accessor is
  // built once per `runAgent` call (closing over this ref + the spark
  // overlay) and torn down when the run completes.
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const activeProjectMode = useProjectStore((s) => s.activeProjectMode);

  const buildContext = useCallback((): AiContext => {
    return {
      projectTitle: project?.title ?? "",
      projectDescription: project?.description ?? "",
      genre: project?.genre ?? "",
      projectMode: activeProjectMode ?? "prose",
      styleGuide: (styleGuide ?? []).filter((e) =>
        isActiveInProject(e, projectId),
      ),
      guardrails: (guardrails ?? []).filter((e) =>
        isActiveInProject(e, projectId),
      ),
      chapters: chapters ?? [],
      currentChapterId: activeChapter?.id,
      currentChapterTitle: activeChapter?.title,
      currentChapterContent: selectedText
        ? undefined
        : activeChapter?.content || undefined,
      selectedText: selectedText || undefined,
    };
  }, [
    projectId,
    project,
    styleGuide,
    guardrails,
    chapters,
    activeChapter,
    selectedText,
    activeProjectMode,
  ]);

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
    // Narrowed alias so nested closures (the delegation host) keep the
    // non-null type — TS widens `projectId` back to `ProjectId | null` across
    // function boundaries.
    const activeProjectId = projectId;
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

    agent.agentContext.delegation = buildDelegationHost({
      depth: 0,
      ancestry: new Set([definition.id]),
      agentName: definition.name,
      activeProjectId,
      context,
      settings,
      signal,
    });

    run.markRunStarted();

    const accessor = makeAiPanelAccessor({
      messagesRef,
      setMessages,
      spark: { isSpark, capturedRange },
      panel: { isPanel },
      awaitToolApproval: run.awaitToolApproval,
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

  async function handleSubmit() {
    if ((!prompt.trim() && pendingImages.length === 0) || run.loading) return;

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

    await run.runWithLoading(async (signal) => {
      await runSelectedAgent(signal);
      if (selectedText) {
        clearSelection();
      }
    });
  }

  function handleCancel() {
    run.abort();
    gates.resetGates();
    setMessages((prev) => {
      // Drop a trailing assistant turn that hasn't been finalized
      // (no durationMs => still in-progress).
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && last.durationMs == null) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  }

  function handleDeleteMessage(index: number) {
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

    await run.runWithLoading((signal) => runSelectedAgent(signal));
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

    await run.runWithLoading((signal) => runSelectedAgent(signal));
  }

  async function handleContinue() {
    const continuePrompt = "Please continue from where you left off.";
    const newUserMsg = makeUserMessage({ content: continuePrompt });

    setMessages((prev) => [...prev, newUserMsg]);

    await run.runWithLoading((signal) => runSelectedAgent(signal));
  }

  // Resolve the active nested transcript when the user has drilled into a
  // delegate call. A stale path (e.g. after clearing the conversation) yields
  // null and falls back to the top-level view.
  const drill = drillPath.length > 0 ? resolveDrill(messages, drillPath) : null;

  return (
    <aside className="flex h-full flex-col bg-white dark:bg-neutral-900">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <Sparkles size={14} />
            AI Assistant
          </h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowRetrievalPreview(true)}
              disabled={!activeChapter}
              title={
                activeChapter
                  ? "Preview retrieved context"
                  : "Open a chapter to preview retrieved context"
              }
              className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <Telescope size={14} />
            </button>
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
                  run.setError(null);
                  setDrillPath([]);
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

      {drill ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2 text-xs dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setDrillPath((p) => p.slice(0, -1))}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-primary-600 transition-colors hover:bg-neutral-100 dark:text-primary-400 dark:hover:bg-neutral-800"
            >
              <ChevronLeft size={14} />
              Back
            </button>
            <span className="truncate text-neutral-500 dark:text-neutral-400">
              Conversation
              {drill.labels.map((label) => ` › ${label}`).join("")}
            </span>
          </div>
          <MessageList
            messages={drill.nested}
            loading={run.loading}
            elapsedMs={run.elapsedMs}
            error={null}
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
            readOnly
            onEnterNested={(toolId) => setDrillPath((p) => [...p, toolId])}
          />
        </div>
      ) : (
        <MessageList
          messages={messages}
          loading={run.loading}
          elapsedMs={run.elapsedMs}
          error={run.error}
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
          onApproveToolCall={(id) => run.resolveToolApproval(id, true)}
          onDenyToolCall={(id) => run.resolveToolApproval(id, false)}
          pendingToolApproval={run.pendingToolApproval}
          onEnterNested={(toolId) => setDrillPath((p) => [...p, toolId])}
        />
      )}

      <PendingGatesBar
        gates={gates.pendingGates}
        onApprove={(gateId) => gates.resolveGate(gateId, true)}
        onDeny={(gateId) => gates.resolveGate(gateId, false)}
        onChoose={(gateId, option) => gates.resolveGate(gateId, option)}
      />

      <PromptInput
        value={prompt}
        onChange={setPrompt}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        loading={run.loading}
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
      {showRetrievalPreview && activeChapter && (
        <RetrievalPreviewDialog
          retrieve={retrieve}
          chapter={activeChapter}
          onClose={() => setShowRetrievalPreview(false)}
        />
      )}
    </aside>
  );
}
