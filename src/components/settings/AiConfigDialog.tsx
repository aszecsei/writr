"use client";

import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import {
  BUTTON_CANCEL,
  INPUT_CLASS,
  LABEL_CLASS,
  RADIO_ACTIVE,
  RADIO_BASE,
  RADIO_INACTIVE,
} from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { updateAppSettings } from "@/db/operations";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TOOL_INSTRUCTIONS,
} from "@/lib/ai/prompts";
import { BUILTIN_TOOL_IDS, type BuiltinAiTool } from "@/lib/ai/types";
import { useUiStore } from "@/store/uiStore";

type ConfigTab = "system-prompt" | "post-chat" | "prefill" | "tools";

const TABS: { id: ConfigTab; label: string }[] = [
  { id: "system-prompt", label: "System Prompt" },
  { id: "post-chat", label: "Post-Chat" },
  { id: "prefill", label: "Prefill" },
  { id: "tools", label: "Tools" },
];

const BUILTIN_TOOL_LABELS: Record<BuiltinAiTool, string> = {
  "generate-prose": "Generate Prose",
  "review-text": "Review Text",
  "suggest-edits": "Suggest Edits",
  "character-dialogue": "Character Dialogue",
  brainstorm: "Brainstorm",
  summarize: "Summarize",
  "consistency-check": "Consistency Check",
};

interface CustomToolDraft {
  id: string;
  name: string;
  prompt: string;
}

export function AiConfigDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const settings = useAppSettings();

  const [tab, setTab] = useState<ConfigTab>("system-prompt");

  // System prompt
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string | null>(
    null,
  );

  // Post-chat
  const [postChatInstructions, setPostChatInstructions] = useState("");
  const [postChatInstructionsDepth, setPostChatInstructionsDepth] = useState(2);

  // Prefill
  const [assistantPrefill, setAssistantPrefill] = useState("");

  // Tools
  const [disabledBuiltinTools, setDisabledBuiltinTools] = useState<string[]>(
    [],
  );
  const [builtinToolOverrides, setBuiltinToolOverrides] = useState<
    Record<string, string>
  >({});
  const [customTools, setCustomTools] = useState<CustomToolDraft[]>([]);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (modal.id !== "ai-config") {
      initializedRef.current = false;
    }
  }, [modal.id]);

  useEffect(() => {
    if (settings && modal.id === "ai-config" && !initializedRef.current) {
      initializedRef.current = true;
      setTab("system-prompt");
      setCustomSystemPrompt(settings.customSystemPrompt);
      setPostChatInstructions(settings.postChatInstructions);
      setPostChatInstructionsDepth(settings.postChatInstructionsDepth);
      setAssistantPrefill(settings.assistantPrefill);
      setDisabledBuiltinTools(settings.disabledBuiltinTools);
      setBuiltinToolOverrides(settings.builtinToolOverrides);
      setCustomTools(settings.customTools.map((t) => ({ ...t })));
    }
  }, [settings, modal.id]);

  if (modal.id !== "ai-config") return null;

  const isDirty =
    settings != null &&
    (customSystemPrompt !== settings.customSystemPrompt ||
      postChatInstructions !== settings.postChatInstructions ||
      postChatInstructionsDepth !== settings.postChatInstructionsDepth ||
      assistantPrefill !== settings.assistantPrefill ||
      JSON.stringify(disabledBuiltinTools) !==
        JSON.stringify(settings.disabledBuiltinTools) ||
      JSON.stringify(builtinToolOverrides) !==
        JSON.stringify(settings.builtinToolOverrides) ||
      JSON.stringify(customTools) !== JSON.stringify(settings.customTools));

  const hasInvalidCustomTool = customTools.some(
    (t) => !t.name.trim() || !t.prompt.trim(),
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await updateAppSettings({
      customSystemPrompt,
      postChatInstructions,
      postChatInstructionsDepth,
      assistantPrefill,
      disabledBuiltinTools,
      builtinToolOverrides,
      customTools: customTools.map((t) => ({
        id: t.id,
        name: t.name.trim(),
        prompt: t.prompt.trim(),
      })),
    });
    closeModal();
  }

  function handleAddCustomTool() {
    setCustomTools((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", prompt: "" },
    ]);
  }

  function handleRemoveCustomTool(id: string) {
    setCustomTools((prev) => prev.filter((t) => t.id !== id));
  }

  function handleUpdateCustomTool(
    id: string,
    field: "name" | "prompt",
    value: string,
  ) {
    setCustomTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    );
  }

  function toggleBuiltinTool(toolId: string) {
    setDisabledBuiltinTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((t) => t !== toolId)
        : [...prev, toolId],
    );
  }

  function setBuiltinOverride(toolId: string, prompt: string) {
    setBuiltinToolOverrides((prev) => ({ ...prev, [toolId]: prompt }));
  }

  function resetBuiltinOverride(toolId: string) {
    setBuiltinToolOverrides((prev) => {
      const next = { ...prev };
      delete next[toolId];
      return next;
    });
  }

  return (
    <Modal onClose={closeModal} maxWidth="max-w-2xl">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        AI Prompts &amp; Tools
      </h2>

      <div className="mt-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${RADIO_BASE} ${tab === t.id ? RADIO_ACTIVE : RADIO_INACTIVE}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-6">
        {tab === "system-prompt" && (
          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              System Prompt
            </legend>
            <div className="mt-2 space-y-3">
              <label className={LABEL_CLASS}>
                Custom System Prompt
                <textarea
                  value={customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT}
                  onChange={(e) => setCustomSystemPrompt(e.target.value)}
                  className={`${INPUT_CLASS} min-h-[120px] resize-y`}
                  rows={4}
                />
                <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  This is the opening instruction sent to the AI. Your story
                  bible context (characters, locations, etc.) is appended
                  automatically.
                </span>
              </label>
              <button
                type="button"
                onClick={() => setCustomSystemPrompt(null)}
                className={`${BUTTON_CANCEL} inline-flex items-center gap-1.5 text-xs`}
              >
                <RotateCcw size={12} />
                Reset to Default
              </button>
            </div>
          </fieldset>
        )}

        {tab === "post-chat" && (
          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Post-Chat Instructions
            </legend>
            <div className="mt-2 space-y-3">
              <label className={LABEL_CLASS}>
                Instructions
                <textarea
                  value={postChatInstructions}
                  onChange={(e) => setPostChatInstructions(e.target.value)}
                  className={`${INPUT_CLASS} min-h-[80px] resize-y`}
                  placeholder="Custom instructions appended to your messages..."
                  rows={3}
                />
                <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  Injected into your messages before sending to the AI. Not
                  visible in chat history.
                </span>
              </label>
              <label className={LABEL_CLASS}>
                Injection Depth
                <input
                  type="number"
                  value={postChatInstructionsDepth}
                  onChange={(e) =>
                    setPostChatInstructionsDepth(
                      Math.max(0, Math.round(Number(e.target.value))),
                    )
                  }
                  className={INPUT_CLASS}
                  min={0}
                  max={10}
                />
                <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  Which user message to append to, counting from the end. 1 =
                  latest message, 2 = second-to-last. 0 = disabled.
                </span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setPostChatInstructions("");
                  setPostChatInstructionsDepth(2);
                }}
                className={`${BUTTON_CANCEL} inline-flex items-center gap-1.5 text-xs`}
              >
                <RotateCcw size={12} />
                Reset to Default
              </button>
            </div>
          </fieldset>
        )}

        {tab === "prefill" && (
          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Assistant Prefill
            </legend>
            <div className="mt-2 space-y-3">
              <label className={LABEL_CLASS}>
                Prefill Text
                <textarea
                  value={assistantPrefill}
                  onChange={(e) => setAssistantPrefill(e.target.value)}
                  className={`${INPUT_CLASS} min-h-[80px] resize-y`}
                  placeholder="Text the assistant begins its response with..."
                  rows={3}
                />
                <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  Appended as a final assistant message so the model continues
                  from this text. Useful for guiding output format or style.
                </span>
              </label>
              <button
                type="button"
                onClick={() => setAssistantPrefill("")}
                className={`${BUTTON_CANCEL} inline-flex items-center gap-1.5 text-xs`}
              >
                <RotateCcw size={12} />
                Reset to Default
              </button>
            </div>
          </fieldset>
        )}

        {tab === "tools" && (
          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Tools
            </legend>
            <div className="mt-2 space-y-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Enable or disable built-in tools and customize their prompts.
              </p>

              {/* Built-in tools */}
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  Built-in Tools
                </h4>
                {BUILTIN_TOOL_IDS.map((toolId) => {
                  const isDisabled = disabledBuiltinTools.includes(toolId);
                  const isExpanded = expandedTool === toolId;
                  const hasOverride = toolId in builtinToolOverrides;

                  return (
                    <div
                      key={toolId}
                      className="rounded-lg border border-neutral-200 dark:border-neutral-700"
                    >
                      <div className="flex items-center gap-2 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!isDisabled}
                          onChange={() => toggleBuiltinTool(toolId)}
                          className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
                        />
                        <button
                          type="button"
                          className="flex-1 text-left text-sm text-neutral-700 dark:text-neutral-300"
                          onClick={() =>
                            setExpandedTool(isExpanded ? null : toolId)
                          }
                        >
                          {BUILTIN_TOOL_LABELS[toolId]}
                          {hasOverride && (
                            <span className="ml-2 text-xs text-primary-500">
                              (customized)
                            </span>
                          )}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-neutral-200 px-3 py-2 dark:border-neutral-700">
                          <label className={LABEL_CLASS}>
                            Tool Prompt
                            <textarea
                              value={
                                builtinToolOverrides[toolId] ??
                                DEFAULT_TOOL_INSTRUCTIONS[toolId]
                              }
                              onChange={(e) =>
                                setBuiltinOverride(toolId, e.target.value)
                              }
                              className={`${INPUT_CLASS} min-h-[80px] resize-y`}
                              rows={4}
                            />
                          </label>
                          {hasOverride && (
                            <button
                              type="button"
                              onClick={() => resetBuiltinOverride(toolId)}
                              className={`${BUTTON_CANCEL} mt-2 inline-flex items-center gap-1.5 text-xs`}
                            >
                              <RotateCcw size={12} />
                              Reset to Default
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Custom tools */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  Custom Tools
                </h4>
                {customTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <label className={LABEL_CLASS}>
                          Name
                          <input
                            type="text"
                            value={tool.name}
                            onChange={(e) =>
                              handleUpdateCustomTool(
                                tool.id,
                                "name",
                                e.target.value,
                              )
                            }
                            className={INPUT_CLASS}
                            placeholder="My Custom Tool"
                          />
                        </label>
                        <label className={LABEL_CLASS}>
                          Prompt
                          <textarea
                            value={tool.prompt}
                            onChange={(e) =>
                              handleUpdateCustomTool(
                                tool.id,
                                "prompt",
                                e.target.value,
                              )
                            }
                            className={`${INPUT_CLASS} min-h-[60px] resize-y`}
                            placeholder="Instructions for this tool..."
                            rows={3}
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomTool(tool.id)}
                        title="Remove custom tool"
                        className="mt-6 rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddCustomTool}
                  className={`${BUTTON_CANCEL} inline-flex items-center gap-1.5 text-xs`}
                >
                  <Plus size={12} />
                  Add Custom Tool
                </button>
              </div>
            </div>
          </fieldset>
        )}

        <DialogFooter
          onCancel={closeModal}
          submitLabel="Save"
          submitDisabled={!isDirty || hasInvalidCustomTool}
        />
      </form>
    </Modal>
  );
}
