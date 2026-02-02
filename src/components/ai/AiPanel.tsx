"use client";

import { AlertCircle, ArrowUp, Sparkles, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { getAppSettings } from "@/db/operations";
import {
  useCharactersByProject,
  useLocationsByProject,
  useRelationshipsByProject,
  useStyleGuideByProject,
  useTimelineByProject,
  useWorldbuildingDocsByProject,
} from "@/hooks/useBibleEntries";
import { useChapter } from "@/hooks/useChapter";
import { useProject } from "@/hooks/useProject";
import { callAi, streamAi } from "@/lib/ai/client";
import { buildMessages } from "@/lib/ai/prompts";
import type { AiContext, AiTool } from "@/lib/ai/types";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";

const AI_TOOLS: { id: AiTool; label: string }[] = [
  { id: "generate-prose", label: "Generate Prose" },
  { id: "review-text", label: "Review Text" },
  { id: "suggest-edits", label: "Suggest Edits" },
  { id: "character-dialogue", label: "Character Dialogue" },
  { id: "brainstorm", label: "Brainstorm" },
  { id: "summarize", label: "Summarize" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AiPanel() {
  const aiPanelOpen = useUiStore((s) => s.aiPanelOpen);
  const projectId = useProjectStore((s) => s.activeProjectId);
  const project = useProject(projectId);
  const characters = useCharactersByProject(projectId);
  const locations = useLocationsByProject(projectId);
  const styleGuide = useStyleGuideByProject(projectId);
  const timelineEvents = useTimelineByProject(projectId);
  const worldbuildingDocs = useWorldbuildingDocsByProject(projectId);
  const relationships = useRelationshipsByProject(projectId);
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

  if (!aiPanelOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userMessage = prompt.trim();
    setPrompt("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
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
        currentChapterTitle: activeChapter?.title,
        currentChapterContent: activeChapter?.content || undefined,
      };

      if (settings.debugMode) {
        const messages = buildMessages(tool, userMessage, context);
        const formatted = messages
          .map((m) => `--- [${m.role.toUpperCase()}] ---\n${m.content}`)
          .join("\n\n");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `[DRY-RUN] Prompt that would be sent to ${settings.preferredModel}:\n\n${formatted}`,
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
        };

        if (settings.streamResponses) {
          setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

          for await (const chunk of streamAi(
            tool,
            userMessage,
            context,
            aiSettings,
          )) {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = {
                ...last,
                content: last.content + chunk,
              };
              return updated;
            });
          }
        } else {
          const response = await callAi(tool, userMessage, context, aiSettings);

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response.content },
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
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
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
            <p className="whitespace-pre-wrap">{msg.content}</p>
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
    </aside>
  );
}
