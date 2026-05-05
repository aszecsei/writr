"use client";

import { type FormEvent, useEffect, useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import {
  createCustomAgent,
  updateCustomAgent,
} from "@/db/operations/customAgents";
import type {
  AgentModelOverride,
  AiProvider,
  ReasoningEffort,
} from "@/db/schemas";
import { useCustomAgent } from "@/hooks/data/useCustomAgents";
import { PROVIDERS } from "@/lib/ai/providers";
import { AI_TOOLS } from "@/lib/ai/tool-calling";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";

const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "grok", label: "Grok (xAI)" },
  { value: "zai", label: "z.ai (Zhipu AI)" },
  { value: "google", label: "Google AI Studio" },
  { value: "vertex", label: "Vertex AI" },
];

const REASONING_OPTIONS: { value: ReasoningEffort; label: string }[] = [
  { value: "xhigh", label: "Extra High" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "minimal", label: "Minimal" },
  { value: "none", label: "None" },
];

/** Group tools for the checkbox picker. The grouping is heuristic — keeps the
 * picker scannable without a separate metadata column on each tool. */
function groupTools() {
  const groups = new Map<string, typeof AI_TOOLS>();
  for (const tool of AI_TOOLS) {
    const group = pickGroup(tool.id);
    const list = groups.get(group) ?? [];
    list.push(tool);
    groups.set(group, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function pickGroup(id: string): string {
  if (id.startsWith("bible_")) return "Reader Bible";
  if (
    id === "note" ||
    id === "question" ||
    id.startsWith("list_notes") ||
    id.startsWith("list_questions")
  )
    return "Notes & Questions";
  if (id.includes("work_unit") || id === "finalize_tier") return "Work Units";
  if (id === "propose_edit") return "Edits";
  if (id === "report_verification") return "Verification";
  if (id === "read_summary") return "Summaries";
  if (id.endsWith("_chapter") || id.includes("chapter_")) return "Chapters";
  if (id.endsWith("_character") || id.includes("character_"))
    return "Characters";
  if (id.endsWith("_location") || id.includes("location_")) return "Locations";
  if (id.includes("timeline_")) return "Timeline";
  if (id.includes("style_guide")) return "Style Guide";
  if (id.includes("worldbuilding")) return "Worldbuilding";
  if (id.includes("outline")) return "Outline";
  if (id.includes("search_")) return "Search";
  return "Other";
}

export function CustomAgentEditor() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const projectId = useProjectStore((s) => s.activeProjectId);

  const editingId =
    modal.id === "custom-agent-editor" ? modal.agentId : undefined;
  const existing = useCustomAgent(editingId ?? null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [scope, setScope] = useState<"project" | "global">("project");
  const [allowedToolIds, setAllowedToolIds] = useState<Set<string>>(new Set());
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideProvider, setOverrideProvider] =
    useState<AiProvider>("openrouter");
  const [overrideModel, setOverrideModel] = useState("");
  const [overrideReasoning, setOverrideReasoning] =
    useState<ReasoningEffort>("medium");
  const [assistantPrefill, setAssistantPrefill] = useState("");

  const initializedRef = useState({ value: false })[0];

  useEffect(() => {
    if (modal.id !== "custom-agent-editor") {
      initializedRef.value = false;
      return;
    }
    // For new agent (no editingId): reset to defaults the first time only.
    // For edit: wait for existing to load, then sync once.
    if (!editingId && !initializedRef.value) {
      setName("");
      setDescription("");
      setSystemPrompt("");
      setScope("project");
      setAllowedToolIds(new Set());
      setOverrideEnabled(false);
      setOverrideModel("");
      setAssistantPrefill("");
      initializedRef.value = true;
      return;
    }
    if (editingId && existing && !initializedRef.value) {
      setName(existing.name);
      setDescription(existing.description);
      setSystemPrompt(existing.systemPrompt);
      setScope(existing.projectId === null ? "global" : "project");
      setAllowedToolIds(new Set(existing.allowedToolIds));
      setOverrideEnabled(existing.modelOverride !== null);
      if (existing.modelOverride) {
        setOverrideProvider(existing.modelOverride.provider);
        setOverrideModel(existing.modelOverride.model);
        setOverrideReasoning(
          existing.modelOverride.reasoningEffort ?? "medium",
        );
      }
      setAssistantPrefill(existing.assistantPrefill);
      initializedRef.value = true;
    }
  }, [modal.id, editingId, existing, initializedRef]);

  if (modal.id !== "custom-agent-editor") return null;

  function toggleTool(id: string) {
    setAllowedToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const modelOverride: AgentModelOverride | null = overrideEnabled
      ? {
          provider: overrideProvider,
          model: overrideModel || PROVIDERS[overrideProvider].defaultModel,
          reasoningEffort: overrideReasoning,
        }
      : null;
    const payload = {
      projectId: scope === "global" ? null : (projectId ?? null),
      name: name.trim(),
      description: description.trim(),
      systemPrompt: systemPrompt.trim(),
      allowedToolIds: [...allowedToolIds],
      modelOverride,
      assistantPrefill: assistantPrefill,
    };
    if (editingId) {
      await updateCustomAgent(editingId, payload);
    } else {
      await createCustomAgent(payload);
    }
    closeModal();
  }

  const grouped = groupTools();
  const canSubmit = name.trim().length > 0 && systemPrompt.trim().length > 0;

  return (
    <Modal onClose={closeModal} maxWidth="max-w-3xl">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {editingId ? "Edit Custom Agent" : "New Custom Agent"}
      </h2>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Saved AI workflows you can run from the AI panel — pair a system prompt
        with a tool subset and an optional model override.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={LABEL_CLASS}>
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Continuity Auditor"
              className={INPUT_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            Scope
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "project" | "global")}
              className={INPUT_CLASS}
            >
              <option value="project">This project only</option>
              <option value="global">Global (all projects)</option>
            </select>
          </label>
        </div>

        <label className={LABEL_CLASS}>
          Description
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — shown in agent picker"
            className={INPUT_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          System Prompt
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            required
            rows={8}
            placeholder="Define the agent's role, output format, and any constraints."
            className={`${INPUT_CLASS} font-mono`}
          />
        </label>

        <label className={LABEL_CLASS}>
          Assistant Prefill (optional)
          <input
            type="text"
            value={assistantPrefill}
            onChange={(e) => setAssistantPrefill(e.target.value)}
            placeholder='e.g. "Here is my analysis:" — primes the assistant turn'
            className={INPUT_CLASS}
          />
        </label>

        <fieldset className="rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Allowed Tools ({allowedToolIds.size})
          </legend>
          <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
            Tools the agent may invoke. Empty = text-only (no tool calling).
            Pipeline tools (bible, notes, work units, propose_edit,
            report_verification) require an active agent run for context — only
            useful inside the manuscript pipeline.
          </p>
          <div className="max-h-[40vh] space-y-3 overflow-y-auto">
            {grouped.map(([group, tools]) => (
              <div key={group}>
                <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {group}
                </h4>
                <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {tools.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300"
                    >
                      <input
                        type="checkbox"
                        checked={allowedToolIds.has(t.id)}
                        onChange={() => toggleTool(t.id)}
                        className="mt-0.5 h-3 w-3 rounded border-neutral-300 dark:border-neutral-600"
                      />
                      <span className="font-mono">{t.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Model Override (optional)
          </legend>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={overrideEnabled}
              onChange={(e) => setOverrideEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
            />
            Use a specific provider/model for this agent
          </label>
          {overrideEnabled && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className={LABEL_CLASS}>
                Provider
                <select
                  value={overrideProvider}
                  onChange={(e) =>
                    setOverrideProvider(e.target.value as AiProvider)
                  }
                  className={INPUT_CLASS}
                >
                  {PROVIDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={LABEL_CLASS}>
                Model
                <input
                  type="text"
                  value={overrideModel}
                  onChange={(e) => setOverrideModel(e.target.value)}
                  placeholder={PROVIDERS[overrideProvider].defaultModel}
                  className={INPUT_CLASS}
                />
              </label>
              <label className={LABEL_CLASS}>
                Reasoning
                <select
                  value={overrideReasoning}
                  onChange={(e) =>
                    setOverrideReasoning(e.target.value as ReasoningEffort)
                  }
                  className={INPUT_CLASS}
                >
                  {REASONING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </fieldset>

        <DialogFooter
          onCancel={closeModal}
          submitLabel={editingId ? "Save" : "Create"}
          submitDisabled={!canSubmit}
        />
      </form>
    </Modal>
  );
}
