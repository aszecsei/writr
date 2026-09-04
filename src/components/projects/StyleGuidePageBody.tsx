"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useReadOnly } from "@/context/DataSourceContext";
import {
  createGuardrailEntry,
  createStyleGuideEntry,
  deleteGuardrailEntry,
  deleteStyleGuideEntry,
  isDisabledInProject,
  setGuardrailDisabledInProject,
  setStyleGuideDisabledInProject,
  updateGuardrailEntry,
  updateStyleGuideEntry,
} from "@/db/operations";
import type {
  GuardrailEntry,
  ProjectId,
  StyleGuideCategory,
  StyleGuideEntry,
} from "@/db/schemas";
import {
  useGuardrailsByProject,
  useStyleGuideByProject,
} from "@/hooks/data/source";
import { useHighlightFade } from "@/hooks/editor/useHighlightFade";

export interface StyleGuidePageBodyProps {
  projectId: ProjectId;
}

export function StyleGuidePageBody({ projectId }: StyleGuidePageBodyProps) {
  const readOnly = useReadOnly();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const entries = useStyleGuideByProject(projectId);
  const guardrails = useGuardrailsByProject(projectId);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<StyleGuideCategory>("custom");
  const [newGlobal, setNewGlobal] = useState(false);
  const [newGuardrailLabel, setNewGuardrailLabel] = useState("");
  const [newGuardrailGlobal, setNewGuardrailGlobal] = useState(false);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    if (!newTitle.trim()) return;
    await createStyleGuideEntry({
      projectId: newGlobal ? null : projectId,
      title: newTitle.trim(),
      category: newCategory,
    });
    setNewTitle("");
    setNewCategory("custom");
    setNewGlobal(false);
  }

  async function handleAddGuardrail(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    if (!newGuardrailLabel.trim()) return;
    await createGuardrailEntry({
      projectId: newGuardrailGlobal ? null : projectId,
      label: newGuardrailLabel.trim(),
    });
    setNewGuardrailLabel("");
    setNewGuardrailGlobal(false);
  }

  return (
    <div className="mx-auto max-w-editor px-8 py-8">
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        Style Guide
      </h2>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Define voice, POV, tense, formatting, and vocabulary rules.
      </p>

      {!readOnly && (
        <form onSubmit={handleAdd} className="mt-6 space-y-2">
          <div className="flex gap-2">
            <select
              value={newCategory}
              onChange={(e) =>
                setNewCategory(e.target.value as StyleGuideCategory)
              }
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              <option value="voice">Voice</option>
              <option value="pov">POV</option>
              <option value="tense">Tense</option>
              <option value="formatting">Formatting</option>
              <option value="vocabulary">Vocabulary</option>
              <option value="custom">Custom</option>
            </select>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Rule title..."
              className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
            >
              Add
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={newGlobal}
              onChange={(e) => setNewGlobal(e.target.checked)}
            />
            Global (applies to all projects)
          </label>
        </form>
      )}

      <div className="mt-6 space-y-4">
        {entries?.length === 0 && (
          <p className="py-12 text-center text-sm text-neutral-400 dark:text-neutral-500">
            No style guide entries yet.
          </p>
        )}
        {entries?.map((entry) => (
          <StyleGuideCard
            key={entry.id}
            entry={entry}
            projectId={projectId}
            isHighlighted={entry.id === highlightId}
            readOnly={readOnly}
          />
        ))}
      </div>

      <h2 className="mt-12 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        Guardrails
      </h2>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Issues to flag: name a problem, the phrasings that trigger it, and how
        to fix it.
      </p>

      {!readOnly && (
        <form onSubmit={handleAddGuardrail} className="mt-6 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newGuardrailLabel}
              onChange={(e) => setNewGuardrailLabel(e.target.value)}
              placeholder="Guardrail label..."
              className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
            <button
              type="submit"
              disabled={!newGuardrailLabel.trim()}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
            >
              Add
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={newGuardrailGlobal}
              onChange={(e) => setNewGuardrailGlobal(e.target.checked)}
            />
            Global (applies to all projects)
          </label>
        </form>
      )}

      <div className="mt-6 space-y-4">
        {guardrails?.length === 0 && (
          <p className="py-12 text-center text-sm text-neutral-400 dark:text-neutral-500">
            No guardrails yet.
          </p>
        )}
        {guardrails?.map((guardrail) => (
          <GuardrailCard
            key={guardrail.id}
            guardrail={guardrail}
            projectId={projectId}
            isHighlighted={guardrail.id === highlightId}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

function StyleGuideCard({
  entry,
  projectId,
  isHighlighted,
  readOnly,
}: {
  entry: StyleGuideEntry;
  projectId: ProjectId;
  isHighlighted?: boolean;
  readOnly: boolean;
}) {
  const { elementRef, showHighlight } = useHighlightFade(isHighlighted);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);
  const [scope, setScope] = useState<"project" | "global">(
    entry.projectId === null ? "global" : "project",
  );

  const isGlobal = entry.projectId === null;
  const disabled = isDisabledInProject(entry, projectId);

  async function handleSave() {
    if (readOnly) return;
    await updateStyleGuideEntry(entry.id, {
      title,
      content,
      projectId: scope === "global" ? null : projectId,
    });
    setEditing(false);
  }

  if (editing && !readOnly) {
    return (
      <div
        ref={elementRef}
        className={`space-y-3 rounded-lg border bg-white p-4 transition-all duration-500 dark:bg-neutral-900 ${
          showHighlight
            ? "border-yellow-400 ring-2 ring-yellow-400 dark:border-yellow-500 dark:ring-yellow-500"
            : "border-neutral-200 dark:border-neutral-800"
        }`}
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          placeholder="Describe the rule or guideline..."
        />
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Scope
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "project" | "global")}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="project">This project only</option>
            <option value="global">Global (all projects)</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={elementRef}
      className={`rounded-lg border bg-white px-5 py-4 transition-all duration-500 dark:bg-neutral-900 ${
        showHighlight
          ? "border-yellow-400 ring-2 ring-yellow-400 dark:border-yellow-500 dark:ring-yellow-500"
          : "border-neutral-200 dark:border-neutral-800"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {entry.title}
          </h3>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {entry.category}
          </span>
          {isGlobal && <ScopeBadge />}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <DisableToggle
              disabled={disabled}
              onChange={(next) =>
                setStyleGuideDisabledInProject(entry.id, projectId, next)
              }
            />
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => deleteStyleGuideEntry(entry.id)}
              className="text-xs text-neutral-400 hover:text-red-500 dark:text-neutral-500"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {entry.content && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-400">
          {entry.content}
        </p>
      )}
    </div>
  );
}

function ScopeBadge() {
  return (
    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
      Global
    </span>
  );
}

function DisableToggle({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500">
      <input
        type="checkbox"
        checked={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      Disabled
    </label>
  );
}

function GuardrailCard({
  guardrail,
  projectId,
  isHighlighted,
  readOnly,
}: {
  guardrail: GuardrailEntry;
  projectId: ProjectId;
  isHighlighted?: boolean;
  readOnly: boolean;
}) {
  const { elementRef, showHighlight } = useHighlightFade(isHighlighted);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(guardrail.label);
  // Flags edit as one-per-line text; split/join at the save/load boundary.
  const [flagsText, setFlagsText] = useState(guardrail.flags.join("\n"));
  const [fix, setFix] = useState(guardrail.fix);
  const [positiveFix, setPositiveFix] = useState(guardrail.positiveFix);
  const [scope, setScope] = useState<"project" | "global">(
    guardrail.projectId === null ? "global" : "project",
  );

  const isGlobal = guardrail.projectId === null;
  const disabled = isDisabledInProject(guardrail, projectId);

  async function handleSave() {
    if (readOnly) return;
    const flags = [
      ...new Set(
        flagsText
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
      ),
    ];
    await updateGuardrailEntry(guardrail.id, {
      label,
      flags,
      fix,
      positiveFix,
      projectId: scope === "global" ? null : projectId,
    });
    setEditing(false);
  }

  if (editing && !readOnly) {
    return (
      <div
        ref={elementRef}
        className={`space-y-3 rounded-lg border bg-white p-4 transition-all duration-500 dark:bg-neutral-900 ${
          showHighlight
            ? "border-yellow-400 ring-2 ring-yellow-400 dark:border-yellow-500 dark:ring-yellow-500"
            : "border-neutral-200 dark:border-neutral-800"
        }`}
      >
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          placeholder="Label..."
        />
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Flags (one phrase per line)
          <textarea
            value={flagsText}
            onChange={(e) => setFlagsText(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder="the way a [comparison]&#10;the kind of [noun] that"
          />
        </label>
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Fix
          <textarea
            value={fix}
            onChange={(e) => setFix(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder="What to do when this is flagged..."
          />
        </label>
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Positive fix
          <textarea
            value={positiveFix}
            onChange={(e) => setPositiveFix(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder="The affirmative reframe..."
          />
        </label>
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Scope
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "project" | "global")}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="project">This project only</option>
            <option value="global">Global (all projects)</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={elementRef}
      className={`rounded-lg border bg-white px-5 py-4 transition-all duration-500 dark:bg-neutral-900 ${
        showHighlight
          ? "border-yellow-400 ring-2 ring-yellow-400 dark:border-yellow-500 dark:ring-yellow-500"
          : "border-neutral-200 dark:border-neutral-800"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {guardrail.label}
          </h3>
          {isGlobal && <ScopeBadge />}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <DisableToggle
              disabled={disabled}
              onChange={(next) =>
                setGuardrailDisabledInProject(guardrail.id, projectId, next)
              }
            />
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => deleteGuardrailEntry(guardrail.id)}
              className="text-xs text-neutral-400 hover:text-red-500 dark:text-neutral-500"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {guardrail.flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {guardrail.flags.map((flag) => (
            <code
              key={flag}
              className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {flag}
            </code>
          ))}
        </div>
      )}
      {guardrail.fix && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-400">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Fix:{" "}
          </span>
          {guardrail.fix}
        </p>
      )}
      {guardrail.positiveFix && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-400">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Instead:{" "}
          </span>
          {guardrail.positiveFix}
        </p>
      )}
    </div>
  );
}
