"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  deleteWorldbuildingDoc,
  updateWorldbuildingDoc,
} from "@/db/operations";
import type { WorldbuildingDoc } from "@/db/schemas";
import { useWorldbuildingDoc } from "@/hooks/data/useBibleEntries";
import { buildWorldbuildingTree, type DocNode } from "@/lib/worldbuilding-tree";

export function WorldbuildingDocDialog({
  docId,
  allDocs,
  onClose,
}: {
  docId: string;
  allDocs: WorldbuildingDoc[];
  onClose: () => void;
}) {
  const doc = useWorldbuildingDoc(docId);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [parentDocId, setParentDocId] = useState<string | null>(null);

  // Build a flat list of docs with depth, excluding self and descendants
  const selectableDocs = useMemo(() => {
    const tree = buildWorldbuildingTree(allDocs);
    const result: { doc: { id: string; title: string }; depth: number }[] = [];
    const excludeIds = new Set<string>();
    excludeIds.add(docId);
    function collectDescendants(nodes: DocNode[]) {
      for (const node of nodes) {
        if (excludeIds.has(node.doc.id)) {
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
  }, [allDocs, docId]);

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
    await updateWorldbuildingDoc(docId, { title, content, tags, parentDocId });
    onClose();
  }

  async function handleDelete() {
    await deleteWorldbuildingDoc(docId);
    onClose();
  }

  async function handleParentChange(newValue: string) {
    const newParentDocId = newValue || null;
    setParentDocId(newParentDocId);
    await updateWorldbuildingDoc(docId, { parentDocId: newParentDocId });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
        <form
          onSubmit={handleSave}
          className="flex flex-1 flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-700">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 bg-transparent text-lg font-bold text-neutral-900 outline-none dark:text-neutral-100"
              placeholder="Document Title"
            />
            <div className="ml-4 flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
              >
                Save
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="flex gap-4">
              <label className="flex-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Parent
                <select
                  value={parentDocId ?? ""}
                  onChange={(e) => handleParentChange(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
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
              <label className="flex-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Tags
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                  placeholder="comma-separated"
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Content
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-mono dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                placeholder="Write your worldbuilding content here (Markdown supported)... Leave empty to use as a section heading."
              />
            </label>
          </div>
        </form>
      </div>
    </div>
  );
}
