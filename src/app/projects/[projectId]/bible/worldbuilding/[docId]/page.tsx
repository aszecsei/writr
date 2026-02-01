"use client";

import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  deleteWorldbuildingDoc,
  updateWorldbuildingDoc,
} from "@/db/operations";
import {
  useWorldbuildingDoc,
  useWorldbuildingDocsByProject,
} from "@/hooks/useBibleEntries";
import { buildWorldbuildingTree, type DocNode } from "@/lib/worldbuilding-tree";

export default function WorldbuildingDocPage() {
  const params = useParams<{ projectId: string; docId: string }>();
  const router = useRouter();
  const doc = useWorldbuildingDoc(params.docId);
  const allDocs = useWorldbuildingDocsByProject(params.projectId);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [parentDocId, setParentDocId] = useState<string | null>(null);

  // Build a flat list of docs with depth, excluding self and descendants
  const selectableDocs = useMemo(() => {
    if (!allDocs) return [];
    const tree = buildWorldbuildingTree(allDocs);
    const result: { doc: { id: string; title: string }; depth: number }[] = [];
    // Collect IDs of this doc and all its descendants to exclude
    const excludeIds = new Set<string>();
    excludeIds.add(params.docId);
    function collectDescendants(nodes: DocNode[]) {
      for (const node of nodes) {
        if (excludeIds.has(node.doc.id)) {
          // Mark all children as excluded too
          function markChildren(n: DocNode) {
            excludeIds.add(n.doc.id);
            for (const c of n.children) markChildren(c);
          }
          for (const c of node.children) markChildren(c);
        }
        collectDescendants(node.children);
      }
    }
    collectDescendants(tree.roots);

    function walk(nodes: DocNode[]) {
      for (const node of nodes) {
        if (!excludeIds.has(node.doc.id)) {
          result.push({
            doc: { id: node.doc.id, title: node.doc.title },
            depth: node.depth,
          });
        }
        walk(node.children);
      }
    }
    walk(tree.roots);
    return result;
  }, [allDocs, params.docId]);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setContent(doc.content);
      setTagsInput(doc.tags.join(", "));
      setParentDocId(doc.parentDocId);
    }
  }, [doc]);

  if (!doc) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await updateWorldbuildingDoc(params.docId, {
      title,
      content,
      tags,
      parentDocId,
    });
  }

  async function handleDelete() {
    await deleteWorldbuildingDoc(params.docId);
    router.push(`/projects/${params.projectId}/bible/worldbuilding`);
  }

  async function handleParentChange(newValue: string) {
    const newParentDocId = newValue || null;
    setParentDocId(newParentDocId);
    await updateWorldbuildingDoc(params.docId, { parentDocId: newParentDocId });
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
            Parent
            <select
              value={parentDocId ?? ""}
              onChange={(e) => handleParentChange(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">None (root level)</option>
              {selectableDocs.map(({ doc: d, depth }) => (
                <option key={d.id} value={d.id}>
                  {"\u00A0\u00A0".repeat(depth)}
                  {d.title}
                </option>
              ))}
            </select>
          </label>
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
              placeholder="Write your worldbuilding content here (Markdown supported)... Leave empty to use as a section heading."
            />
          </label>
        </div>
      </form>
    </div>
  );
}
