"use client";

import { useParams, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  createStyleGuideEntry,
  deleteStyleGuideEntry,
  updateStyleGuideEntry,
} from "@/db/operations";
import type { StyleGuideCategory } from "@/db/schemas";
import { useStyleGuideByProject } from "@/hooks/useBibleEntries";
import { useHighlightFade } from "@/hooks/useHighlightFade";

export default function StyleGuidePage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const entries = useStyleGuideByProject(params.projectId);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<StyleGuideCategory>("custom");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createStyleGuideEntry({
      projectId: params.projectId,
      title: newTitle.trim(),
      category: newCategory,
    });
    setNewTitle("");
    setNewCategory("custom");
  }

  return (
    <div className="mx-auto max-w-editor px-8 py-8">
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        Style Guide
      </h2>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Define voice, POV, tense, formatting, and vocabulary rules.
      </p>

      <form onSubmit={handleAdd} className="mt-6 flex gap-2">
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value as StyleGuideCategory)}
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
      </form>

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
            isHighlighted={entry.id === highlightId}
          />
        ))}
      </div>
    </div>
  );
}

function StyleGuideCard({
  entry,
  isHighlighted,
}: {
  entry: {
    id: string;
    title: string;
    category: string;
    content: string;
  };
  isHighlighted?: boolean;
}) {
  const { elementRef, showHighlight } = useHighlightFade(isHighlighted);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);

  async function handleSave() {
    await updateStyleGuideEntry(entry.id, { title, content });
    setEditing(false);
  }

  if (editing) {
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
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {entry.title}
          </h3>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {entry.category}
          </span>
        </div>
        <div className="flex gap-2">
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
      </div>
      {entry.content && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-400">
          {entry.content}
        </p>
      )}
    </div>
  );
}
