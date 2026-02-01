"use client";

import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import {
  deleteWorldbuildingDoc,
  updateWorldbuildingDoc,
} from "@/db/operations";
import { useWorldbuildingDoc } from "@/hooks/useBibleEntries";

export default function WorldbuildingDocPage() {
  const params = useParams<{ projectId: string; docId: string }>();
  const router = useRouter();
  const doc = useWorldbuildingDoc(params.docId);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setContent(doc.content);
      setTagsInput(doc.tags.join(", "));
    }
  }, [doc]);

  if (!doc) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await updateWorldbuildingDoc(params.docId, { title, content, tags });
  }

  async function handleDelete() {
    await deleteWorldbuildingDoc(params.docId);
    router.push(`/projects/${params.projectId}/bible/worldbuilding`);
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex items-center justify-between">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold text-zinc-900 bg-transparent border-none outline-none dark:text-zinc-100"
            placeholder="Document Title"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              Delete
            </button>
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Tags
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="magic, religion, politics (comma-separated)"
            />
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Content
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Write your worldbuilding content here (Markdown supported)..."
            />
          </label>
        </div>
      </form>
    </div>
  );
}
