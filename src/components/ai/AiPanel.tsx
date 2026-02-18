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
import type { AppSettings } from "@/db/schemas";
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
import { callAi, streamAi } from "@/lib/ai/client";
import { buildMessages } from "@/lib/ai/prompts";
import { PROVIDERS } from "@/lib/ai/providers";
import {
  AI_TOOL_MAP,
  executeTool,
  getToolDefinitionsForModel,
  type ToolCallEntry,
  type ToolCallPayload,
} from "@/lib/ai/tool-calling";
import type {
  AiContext,
  AiMessage,
  AiToolId,
  BuiltinAiTool,
  FinishReason,
} from "@/lib/ai/types";
import { BUILTIN_TOOL_IDS } from "@/lib/ai/types";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { ImageAttachmentPicker } from "./ImageAttachmentPicker";
import type { Message } from "./MessageList";
import { MessageList } from "./MessageList";
import type { PendingImage } from "./PromptInput";
import { PromptInput } from "./PromptInput";
import { PromptInspectorDialog } from "./PromptInspectorDialog";
import { ToolSelector } from "./ToolSelector";

function formatDebugMessages(messages: AiMessage[], model: string): string {
  const formatted = messages
    .map((m) => {
      const text =
        typeof m.content === "string"
          ? m.content
          : m.content
              .map((p) =>
                p.type === "text"
                  ? p.text
                  : `[image: ${p.image_url.url.slice(0, 60)}...]`,
              )
              .join("");
      return `--- [${m.role.toUpperCase()}] ---\n${text}`;
    })
    .join("\n\n");
  return `[DRY-RUN] Prompt that would be sent to ${model}:\n\n${formatted}`;
}

function resolveToolPrompt(
  toolId: AiToolId,
  settings: AppSettings,
): string | undefined {
  // Check built-in tool overrides
  if (BUILTIN_TOOL_IDS.includes(toolId as BuiltinAiTool)) {
    return settings.builtinToolOverrides[toolId];
  }
  // Check custom tools
  const custom = settings.customTools.find((t) => t.id === toolId);
  return custom?.prompt;
}

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

      // Include tool calls on assistant messages
      if (m.toolCalls?.length) {
        msg.toolCalls = m.toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.toolName,
          arguments: tc.input,
        }));
      }

      result.push(msg);
    }

    // Emit tool result messages after assistant messages that had tool calls
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
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const activeChapter = useChapter(
    activeDocumentType === "chapter" ? activeDocumentId : null,
  );

  const [tool, setTool] = useState<AiToolId>("generate-prose");
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

  /** Wait for user to click Approve or Deny on a write tool call */
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
    const settings = await getAppSettings();
    const context = buildContext();

    const aiHistory = messagesToAiHistory(history);

    // Resolve tool prompt override
    const toolPromptOverride = resolveToolPrompt(tool, settings);

    const imageAttachments = images?.map((img) => ({ url: img.url }));

    if (settings.debugMode) {
      const debugMessages = buildMessages(
        tool,
        userMessage,
        context,
        aiHistory,
        {
          postChatInstructions: settings.postChatInstructions,
          postChatInstructionsDepth: settings.postChatInstructionsDepth,
          assistantPrefill: settings.assistantPrefill,
          customSystemPrompt: settings.customSystemPrompt,
          toolPromptOverride,
          images: imageAttachments,
          enableToolCalling: settings.enableToolCalling ?? false,
        },
      );
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: formatDebugMessages(
            debugMessages,
            settings.providerModels[settings.aiProvider],
          ),
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    const provider = settings.aiProvider;
    const providerConfig = PROVIDERS[provider];
    const apiKey = settings.providerApiKeys[provider];

    if (!apiKey) {
      throw new Error(
        `No API key configured. Add your ${providerConfig.label} API key in App Settings.`,
      );
    }

    const enableToolCalling = settings.enableToolCalling ?? false;
    const toolDefinitions =
      enableToolCalling && projectId ? getToolDefinitionsForModel() : undefined;

    const aiSettings = {
      apiKey,
      model: settings.providerModels[provider],
      provider,
      reasoningEffort: settings.reasoningEffort,
      postChatInstructions: settings.postChatInstructions,
      postChatInstructionsDepth: settings.postChatInstructionsDepth,
      assistantPrefill: settings.assistantPrefill,
      customSystemPrompt: settings.customSystemPrompt,
      toolPromptOverride,
      images: imageAttachments,
      toolDefinitions,
    };

    const capturedPrompt = buildMessages(
      tool,
      userMessage,
      context,
      aiHistory,
      {
        postChatInstructions: settings.postChatInstructions,
        postChatInstructionsDepth: settings.postChatInstructionsDepth,
        assistantPrefill: settings.assistantPrefill,
        customSystemPrompt: settings.customSystemPrompt,
        toolPromptOverride,
        images: imageAttachments,
        enableToolCalling,
      },
    );
    const startTime = Date.now();
    requestStartRef.current = startTime;
    setElapsedMs(0);

    // Tool-calling while loop: stream → collect tool_use → execute/approve → loop
    let currentAiHistory = aiHistory;
    let currentCapturedPrompt = capturedPrompt;
    let isFirstIteration = true;

    while (true) {
      if (signal.aborted) break;

      const assistantId = generateId();
      const collectedToolCalls: ToolCallPayload[] = [];

      // On iteration 2+, the user message is already in the history
      // (from messagesToAiHistory), so skip appending it again.
      const iterationSettings = isFirstIteration
        ? aiSettings
        : { ...aiSettings, skipUserPrompt: true };

      if (settings.streamResponses) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: "",
            timestamp: new Date().toISOString(),
            promptMessages: isFirstIteration
              ? currentCapturedPrompt
              : undefined,
          },
        ]);

        let streamFinishReason: FinishReason | undefined;
        for await (const chunk of streamAi(
          tool,
          userMessage,
          context,
          iterationSettings,
          currentAiHistory,
          signal,
        )) {
          if (signal.aborted) break;
          if (chunk.type === "stop") {
            streamFinishReason = chunk.finishReason;
            continue;
          }
          if (chunk.type === "tool_use") {
            collectedToolCalls.push({
              id: chunk.id,
              name: chunk.name,
              input: chunk.input,
            });
            continue;
          }
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

        // If no tool calls, finalize and exit loop
        if (
          streamFinishReason !== "tool_use" ||
          collectedToolCalls.length === 0
        ) {
          const elapsed = Date.now() - startTime;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = {
              ...last,
              durationMs: elapsed,
              finishReason: streamFinishReason,
            };
            return updated;
          });
          break;
        }

        // Process tool calls
        await processToolCalls(assistantId, collectedToolCalls, signal);
      } else {
        const response = await callAi(
          tool,
          userMessage,
          context,
          iterationSettings,
          currentAiHistory,
          signal,
        );

        if (
          response.finishReason !== "tool_use" ||
          !response.toolCalls?.length
        ) {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              content: response.content,
              reasoning: response.reasoning,
              timestamp: new Date().toISOString(),
              promptMessages: isFirstIteration
                ? currentCapturedPrompt
                : undefined,
              durationMs: Date.now() - startTime,
              finishReason: response.finishReason,
            },
          ]);
          break;
        }

        // Has tool calls - add assistant message then process
        const payloads: ToolCallPayload[] = response.toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        }));

        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: response.content,
            reasoning: response.reasoning,
            timestamp: new Date().toISOString(),
            promptMessages: isFirstIteration
              ? currentCapturedPrompt
              : undefined,
          },
        ]);

        await processToolCalls(assistantId, payloads, signal);
      }

      if (signal.aborted) break;

      // Rebuild history from current messages state for next iteration
      // We need to read the latest messages state
      const latestMessages = await new Promise<Message[]>((resolve) => {
        setMessages((prev) => {
          resolve(prev);
          return prev;
        });
      });

      currentAiHistory = messagesToAiHistory(latestMessages);
      currentCapturedPrompt = [];
      isFirstIteration = false;
    }
  }

  /** Process tool calls: auto-execute reads, prompt for writes */
  async function processToolCalls(
    assistantMsgId: string,
    payloads: ToolCallPayload[],
    signal: AbortSignal,
  ) {
    if (!projectId) return;

    // Build ToolCallEntry[] and attach to the assistant message
    const entries: ToolCallEntry[] = payloads.map((p) => {
      const toolDef = AI_TOOL_MAP.get(p.name);
      return {
        id: p.id,
        toolName: p.name,
        displayName: toolDef?.name ?? p.name,
        input: p.input,
        status: toolDef?.requiresApproval
          ? ("pending" as const)
          : ("approved" as const),
      };
    });

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMsgId ? { ...msg, toolCalls: entries } : msg,
      ),
    );

    // Process each tool call sequentially
    for (const entry of entries) {
      if (signal.aborted) break;

      const toolDef = AI_TOOL_MAP.get(entry.toolName);
      if (!toolDef) {
        updateToolCallEntry(assistantMsgId, entry.id, {
          status: "error",
          result: {
            success: false,
            message: `Unknown tool: ${entry.toolName}`,
          },
        });
        continue;
      }

      if (toolDef.requiresApproval) {
        // Wait for user approval
        setPendingToolApproval(true);
        const approved = await waitForToolDecision();
        setPendingToolApproval(false);

        if (signal.aborted) break;

        if (!approved) {
          updateToolCallEntry(assistantMsgId, entry.id, {
            status: "denied",
          });
          continue;
        }
      }

      // Execute the tool (with auto-validation via executeTool)
      const result = await executeTool(entry.toolName, entry.input, {
        projectId,
      });
      updateToolCallEntry(assistantMsgId, entry.id, {
        status: result.success ? "executed" : "error",
        result,
      });
    }
  }

  function updateToolCallEntry(
    messageId: string,
    toolCallId: string,
    update: Partial<ToolCallEntry>,
  ) {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              toolCalls: msg.toolCalls?.map((tc) =>
                tc.id === toolCallId ? { ...tc, ...update } : tc,
              ),
            }
          : msg,
      ),
    );
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
      // Get current messages for history (before adding user message)
      const history = messages;
      await generateAiResponse(
        userMessage,
        history,
        controller.signal,
        attachedImages,
      );

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
      setPendingToolApproval(false);
      abortControllerRef.current = null;
    }
  }

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Resolve any pending tool approval as denied
    if (toolCallResolverRef.current) {
      toolCallResolverRef.current.resolve(false);
      toolCallResolverRef.current = null;
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
    setPendingToolApproval(false);
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
      setPendingToolApproval(false);
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
