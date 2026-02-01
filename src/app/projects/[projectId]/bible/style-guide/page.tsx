"use client";

import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  createStyleGuideEntry,
  deleteStyleGuideEntry,
  updateStyleGuideEntry,
} from "@/db/operations";
import type { StyleGuideCategory } from "@/db/schemas";
import { useStyleGuideByProject } from "@/hooks/useBibleEntries";

export default function StyleGuidePage() {
  const params = useParams<{ projectId: string }>();
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
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Style Guide
      </h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Define voice, POV, tense, formatting, and vocabulary rules.
      </p>

      <form onSubmit={handleAdd} className="mt-6 flex gap-2">
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value as StyleGuideCategory)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
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
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={!newTitle.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add
        </button>
      </form>

      <div className="mt-6 space-y-4">
        {entries?.length === 0 && (
          <p className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
            No style guide entries yet.
          </p>
        )}
        {entries?.map((entry) => (
          <StyleGuideCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function StyleGuideCard({
  entry,
}: {
  entry: {
    id: string;
    title: string;
    category: string;
    content: string;
  };
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);

  async function handleSave() {
    await updateStyleGuideEntry(entry.id, { title, content });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="Describe the rule or guideline..."
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {entry.title}
          </h3>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {entry.category}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => deleteStyleGuideEntry(entry.id)}
            className="text-xs text-zinc-400 hover:text-red-500 dark:text-zinc-500"
          >
            Delete
          </button>
        </div>
      </div>
      {entry.content && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
          {entry.content}
        </p>
      )}
    </div>
  );
}
