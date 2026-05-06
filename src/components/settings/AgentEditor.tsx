"use client";

import { type FormEvent, useEffect, useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { TriStateCheckbox } from "@/components/ui/TriStateCheckbox";
import { createAgent, updateAgent } from "@/db/operations/agents";
import type {
  AgentModelOverride,
  AiProvider,
  ReasoningEffort,
} from "@/db/schemas";
import { useAgent } from "@/hooks/data/useAgents";
import { PROVIDERS } from "@/lib/ai/providers";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";
import {
  ALL_READ_TOOL_IDS,
  MUTATIONS_GROUPS,
  READS_GROUPS,
  readsMasterState,
  rowState,
  type ToolPickerRow,
  toggleAllReads,
  toggleRow,
} from "./agent-tool-picker";

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

export function AgentEditor() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const projectId = useProjectStore((s) => s.activeProjectId);

  const editingId = modal.id === "agent-editor" ? modal.agentId : undefined;
  const existing = useAgent(editingId ?? null);

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
    if (modal.id !== "agent-editor") {
      initializedRef.value = false;
      return;
    }
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

  if (modal.id !== "agent-editor") return null;

  const isBuiltin = existing && existing.kind !== "user";

  function toggleRowIds(row: ToolPickerRow) {
    setAllowedToolIds((prev) => toggleRow(row, prev));
  }

  function toggleAllReadIds() {
    setAllowedToolIds((prev) => toggleAllReads(prev));
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
    if (editingId && existing) {
      await updateAgent(editingId, {
        name: name.trim(),
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        allowedToolIds: [...allowedToolIds],
        modelOverride,
        assistantPrefill,
        // Built-in agents stay global; only user agents can change scope.
        ...(existing.kind === "user"
          ? { projectId: scope === "global" ? null : (projectId ?? null) }
          : {}),
      });
    } else {
      await createAgent({
        kind: "user",
        projectId: scope === "global" ? null : (projectId ?? null),
        name: name.trim(),
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        allowedToolIds: [...allowedToolIds],
        modelOverride,
        assistantPrefill,
      });
    }
    closeModal();
  }

  const canSubmit = name.trim().length > 0 && systemPrompt.trim().length > 0;
  const masterReadsState = readsMasterState(allowedToolIds);
  const readsActiveCount = ALL_READ_TOOL_IDS.reduce(
    (n, id) => n + (allowedToolIds.has(id) ? 1 : 0),
    0,
  );

  const headerTitle = editingId
    ? isBuiltin
      ? `Edit ${existing?.name ?? "agent"}`
      : "Edit Agent"
    : "New Agent";

  return (
    <Modal onClose={closeModal} maxWidth="max-w-3xl">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {headerTitle}
      </h2>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {isBuiltin
          ? "Built-in agent. Edit the system prompt, allowed tools, or model override; use Reset to restore defaults."
          : "Saved AI workflow — pair a system prompt with a tool subset and an optional model override."}
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
          {!isBuiltin && (
            <label className={LABEL_CLASS}>
              Scope
              <select
                value={scope}
                onChange={(e) =>
                  setScope(e.target.value as "project" | "global")
                }
                className={INPUT_CLASS}
              >
                <option value="project">This project only</option>
                <option value="global">Global (all projects)</option>
              </select>
            </label>
          )}
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
            rows={10}
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
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Tools the agent may invoke. Empty = text-only (no tool calling).
            Pipeline-only tools require an active agent run for context — only
            useful inside the manuscript pipeline.
          </p>

          <div className="max-h-[50vh] space-y-4 overflow-y-auto">
            {/* Reads section: master toggle + per-category rows. */}
            <section>
              <label
                htmlFor="agent-tool-master-reads"
                className="flex items-center gap-2 border-b border-neutral-200 pb-2 text-sm font-semibold text-neutral-800 dark:border-neutral-700 dark:text-neutral-200"
              >
                <TriStateCheckbox
                  id="agent-tool-master-reads"
                  state={masterReadsState}
                  onToggle={toggleAllReadIds}
                  className="h-3.5 w-3.5 rounded border-neutral-300 dark:border-neutral-600"
                  ariaLabel="Toggle all reads"
                />
                <span>
                  Reads{" "}
                  <span className="font-normal text-neutral-500 dark:text-neutral-400">
                    ({readsActiveCount}/{ALL_READ_TOOL_IDS.length})
                  </span>
                </span>
              </label>

              <div className="mt-2 space-y-3 pl-5">
                {READS_GROUPS.map((group) => (
                  <div key={group.heading}>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {group.heading}
                    </h4>
                    <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {group.rows.map((row) => (
                        <label
                          key={row.key}
                          htmlFor={`agent-tool-${row.key}`}
                          className="flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300"
                        >
                          <TriStateCheckbox
                            id={`agent-tool-${row.key}`}
                            state={rowState(row, allowedToolIds)}
                            onToggle={() => toggleRowIds(row)}
                            className="mt-0.5 h-3 w-3 rounded border-neutral-300 dark:border-neutral-600"
                            ariaLabel={`Toggle ${row.label}`}
                          />
                          <span className="leading-tight">
                            <span>
                              {row.label}
                              {row.pipeline && (
                                <span className="ml-1 text-[10px] uppercase tracking-wide text-neutral-400">
                                  pipeline
                                </span>
                              )}
                            </span>
                            {row.hint && (
                              <span className="block font-mono text-[10px] text-neutral-500 dark:text-neutral-400">
                                {row.hint}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Mutations: flat per-tool checkboxes, grouped by entity. */}
            <section>
              <h3 className="border-b border-neutral-200 pb-2 text-sm font-semibold text-neutral-800 dark:border-neutral-700 dark:text-neutral-200">
                Mutations
              </h3>
              <div className="mt-2 space-y-3">
                {MUTATIONS_GROUPS.map((group) => (
                  <div key={group.heading}>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {group.heading}
                    </h4>
                    <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {group.rows.map((row) => (
                        <label
                          key={row.key}
                          htmlFor={`agent-tool-${row.key}`}
                          className="flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300"
                        >
                          <TriStateCheckbox
                            id={`agent-tool-${row.key}`}
                            state={rowState(row, allowedToolIds)}
                            onToggle={() => toggleRowIds(row)}
                            className="mt-0.5 h-3 w-3 rounded border-neutral-300 dark:border-neutral-600"
                            ariaLabel={`Toggle ${row.label}`}
                          />
                          <span className="font-mono leading-tight">
                            {row.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
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
