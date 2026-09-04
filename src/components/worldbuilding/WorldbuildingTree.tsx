"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BUTTON_PRIMARY } from "@/components/ui/button-styles";
import {
  createWorldbuildingDoc,
  deleteWorldbuildingDoc,
  reorderWorldbuildingDocs,
  updateWorldbuildingDoc,
} from "@/db/operations";
import type {
  ProjectId,
  WorldbuildingDoc,
  WorldbuildingDocId,
} from "@/db/schemas";
import { useWorldbuildingDocsByProject } from "@/hooks/data/useBibleEntries";
import {
  buildWorldbuildingTree,
  compileWorldbuildingToMarkdown,
  type DocNode,
  descendantIds,
} from "@/lib/worldbuilding-tree";
import { CompiledView } from "./CompiledView";
import { WorldbuildingDocDialog } from "./WorldbuildingDocDialog";

type Tab = "tree" | "compiled";

export interface WorldbuildingTreeProps {
  projectId: ProjectId;
}

export function WorldbuildingTree({ projectId }: WorldbuildingTreeProps) {
  const docs = useWorldbuildingDocsByProject(projectId);
  const [tab, setTab] = useState<Tab>("tree");
  const [expanded, setExpanded] = useState<Set<WorldbuildingDocId>>(
    () => new Set(),
  );
  const [editingDocId, setEditingDocId] = useState<WorldbuildingDocId | null>(
    null,
  );
  const [editingTitle, setEditingTitle] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<WorldbuildingDocId | null>(
    null,
  );

  const tree = useMemo(() => buildWorldbuildingTree(docs ?? []), [docs]);

  const compiled = useMemo(() => compileWorldbuildingToMarkdown(tree), [tree]);

  // Flat list of all docs with depth for "move to" selects
  const flatDocs = useMemo(() => {
    const result: { doc: WorldbuildingDoc; depth: number }[] = [];
    function walk(nodes: DocNode[]) {
      for (const node of nodes) {
        result.push({ doc: node.doc, depth: node.depth });
        walk(node.children);
      }
    }
    walk(tree.roots);
    return result;
  }, [tree]);

  // Each doc's own descendant-id set, computed once per tree so the "move to
  // parent" select below can filter out cycle-creating targets in O(1) per
  // option instead of re-walking parent chains for every option on every render.
  const descendantIdsByDoc = useMemo(() => {
    const map = new Map<WorldbuildingDocId, Set<WorldbuildingDocId>>();
    for (const { doc } of flatDocs) {
      map.set(doc.id, descendantIds(tree, doc.id));
    }
    return map;
  }, [tree, flatDocs]);

  // Expand all by default the first time docs load.
  const didInitExpansion = useRef(false);
  useEffect(() => {
    if (!didInitExpansion.current && docs && docs.length > 0) {
      setExpanded(new Set(docs.map((d) => d.id)));
      didInitExpansion.current = true;
    }
  }, [docs]);

  function toggleExpand(id: WorldbuildingDocId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddDoc(parentDocId: WorldbuildingDocId | null = null) {
    const doc = await createWorldbuildingDoc({
      projectId,
      title: "New Document",
      parentDocId,
    });
    setExpanded((prev) => new Set(prev).add(doc.id));
    setEditingDocId(doc.id);
    setEditingTitle("New Document");
  }

  async function handleRenameDoc(id: WorldbuildingDocId) {
    if (editingTitle.trim()) {
      await updateWorldbuildingDoc(id, { title: editingTitle.trim() });
    }
    setEditingDocId(null);
  }

  async function handleMoveUp(node: DocNode, siblings: DocNode[]) {
    const idx = siblings.findIndex((s) => s.doc.id === node.doc.id);
    if (idx <= 0) return;
    const ids = siblings.map((s) => s.doc.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    await reorderWorldbuildingDocs(ids);
  }

  async function handleMoveDown(node: DocNode, siblings: DocNode[]) {
    const idx = siblings.findIndex((s) => s.doc.id === node.doc.id);
    if (idx < 0 || idx >= siblings.length - 1) return;
    const ids = siblings.map((s) => s.doc.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    await reorderWorldbuildingDocs(ids);
  }

  async function handleMoveToParent(
    docId: WorldbuildingDocId,
    newParentId: WorldbuildingDocId | null,
  ) {
    // Append at end of target's children
    const targetChildren = (docs ?? []).filter(
      (d) => d.parentDocId === newParentId,
    );
    await updateWorldbuildingDoc(docId, {
      parentDocId: newParentId,
      order: targetChildren.length,
    });
  }

  function renderDocNode(node: DocNode, siblings: DocNode[]) {
    const isExpanded = expanded.has(node.doc.id);
    const idx = siblings.findIndex((s) => s.doc.id === node.doc.id);
    const isFirst = idx === 0;
    const isLast = idx === siblings.length - 1;
    const hasChildren = node.children.length > 0;
    const isHeading = !node.doc.content.trim();
    const excludedIds = descendantIdsByDoc.get(node.doc.id);

    return (
      <div key={node.doc.id}>
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 ${
            isHeading
              ? "border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50"
              : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
          }`}
          style={{ marginLeft: `${node.depth * 24}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(node.doc.id)}
              className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              {isExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          ) : (
            <span className="w-4 text-center text-neutral-300 dark:text-neutral-600">
              {isHeading ? (
                <Circle size={10} className="mx-auto" />
              ) : (
                <CircleDot size={10} className="mx-auto" />
              )}
            </span>
          )}
          {editingDocId === node.doc.id ? (
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={() => handleRenameDoc(node.doc.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameDoc(node.doc.id);
                if (e.key === "Escape") setEditingDocId(null);
              }}
              className="flex-1 rounded border border-neutral-300 bg-white px-2 py-0.5 text-sm font-semibold dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              ref={(el) => el?.focus()}
            />
          ) : (
            <button
              type="button"
              onClick={() => setSelectedDocId(node.doc.id)}
              className="flex-1 text-left"
            >
              <span
                className={`text-sm ${isHeading ? "font-semibold" : "font-medium"} text-neutral-900 dark:text-neutral-100`}
              >
                {node.doc.title}
              </span>
              {node.doc.tags.length > 0 && (
                <span className="ml-2 inline-flex gap-1">
                  {node.doc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingDocId(node.doc.id);
              setEditingTitle(node.doc.title);
            }}
            className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
            title="Rename"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => handleAddDoc(node.doc.id)}
            className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
            title="Add child document"
          >
            + Child
          </button>
          <select
            value={node.doc.parentDocId ?? ""}
            onChange={(e) =>
              handleMoveToParent(
                node.doc.id,
                (e.target.value || null) as WorldbuildingDocId | null,
              )
            }
            className="rounded border border-neutral-200 bg-transparent px-2 py-1 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
            title="Move to parent"
          >
            <option value="">Root</option>
            {flatDocs
              .filter(
                ({ doc: d }) => d.id !== node.doc.id && !excludedIds?.has(d.id),
              )
              .map(({ doc: d, depth: dd }) => (
                <option key={d.id} value={d.id}>
                  {"  ".repeat(dd)}
                  {d.title}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => handleMoveUp(node, siblings)}
            disabled={isFirst}
            className="px-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-300"
            title="Move up"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => handleMoveDown(node, siblings)}
            disabled={isLast}
            className="px-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-300"
            title="Move down"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            onClick={() => deleteWorldbuildingDoc(node.doc.id)}
            className="px-1 text-xs text-neutral-400 hover:text-red-500 dark:text-neutral-500"
            title="Delete (children will be re-parented)"
          >
            Delete
          </button>
        </div>
        {isExpanded && node.children.length > 0 && (
          <div className="mt-1.5 space-y-1.5">
            {node.children.map((child) => renderDocNode(child, node.children))}
          </div>
        )}
      </div>
    );
  }

  const isEmpty = !docs || docs.length === 0;

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Worldbuilding
        </h2>
        <button
          type="button"
          onClick={() => handleAddDoc(null)}
          className={BUTTON_PRIMARY}
        >
          Add Document
        </button>
      </div>

      <div className="mt-6 flex border-b border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setTab("tree")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "tree"
              ? "border-b-2 border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400"
              : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
          }`}
        >
          Tree
        </button>
        <button
          type="button"
          onClick={() => setTab("compiled")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "compiled"
              ? "border-b-2 border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400"
              : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
          }`}
        >
          Compiled
        </button>
      </div>

      <div className="mt-6">
        {tab === "tree" ? (
          isEmpty ? (
            <p className="py-12 text-center text-sm text-neutral-400 dark:text-neutral-500">
              No worldbuilding content yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {tree.roots.map((node) => renderDocNode(node, tree.roots))}
            </div>
          )
        ) : (
          <CompiledView markdown={compiled} />
        )}
      </div>

      {selectedDocId && (
        <WorldbuildingDocDialog
          docId={selectedDocId}
          allDocs={docs ?? []}
          onClose={() => setSelectedDocId(null)}
        />
      )}
    </div>
  );
}
