"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import {
  deleteWorldbuildingDoc,
  updateWorldbuildingDoc,
} from "@/db/operations";
import type { WorldbuildingDoc, WorldbuildingDocId } from "@/db/schemas";
import { useWorldbuildingDoc } from "@/hooks/data/useBibleEntries";
import {
  buildWorldbuildingTree,
  type DocNode,
  descendantIds,
} from "@/lib/worldbuilding-tree";

export function WorldbuildingDocDialog({
  docId,
  allDocs,
  onClose,
}: {
  docId: WorldbuildingDocId;
  allDocs: WorldbuildingDoc[];
  onClose: () => void;
}) {
  const doc = useWorldbuildingDoc(docId);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [parentDocId, setParentDocId] = useState<WorldbuildingDocId | null>(
    null,
  );

  // Build a flat list of docs with depth, excluding self and descendants
  // (moving a doc under its own descendant would create a cycle).
  const selectableDocs = useMemo(() => {
    const tree = buildWorldbuildingTree(allDocs);
    const excludeIds = descendantIds(tree, docId);
    excludeIds.add(docId);

    const result: { doc: { id: string; title: string }; depth: number }[] = [];
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
    const newParentDocId = (newValue || null) as WorldbuildingDocId | null;
    setParentDocId(newParentDocId);
    await updateWorldbuildingDoc(docId, { parentDocId: newParentDocId });
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSave} className="space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent text-lg font-bold text-neutral-900 outline-none dark:text-neutral-100"
          placeholder="Document Title"
        />
        <div className="flex gap-4">
          <label className={`flex-1 ${LABEL_CLASS}`}>
            Parent
            <select
              value={parentDocId ?? ""}
              onChange={(e) => handleParentChange(e.target.value)}
              className={INPUT_CLASS}
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
          <label className={`flex-1 ${LABEL_CLASS}`}>
            Tags
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className={INPUT_CLASS}
              placeholder="comma-separated"
            />
          </label>
        </div>
        <label className={LABEL_CLASS}>
          Content
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            className={`font-mono ${INPUT_CLASS}`}
            placeholder="Write your worldbuilding content here (Markdown supported)... Leave empty to use as a section heading."
          />
        </label>
        <DialogFooter
          onCancel={onClose}
          submitLabel="Save"
          left={
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              Delete
            </button>
          }
        />
      </form>
    </Modal>
  );
}
