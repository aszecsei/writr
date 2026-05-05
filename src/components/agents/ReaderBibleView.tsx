"use client";

import ReactJson from "@microlink/react-json-view";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useReaderBible } from "@/hooks/data/useReaderBible";

interface ReaderBibleViewProps {
  runId: string;
}

function useIsDark(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => obs.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

interface TreeNode {
  segment: string;
  fullPath: string;
  children: TreeNode[];
  value: unknown | null;
  hasValue: boolean;
}

/**
 * Tree view of the reader's bible, grouped by path. Click a leaf path to view
 * the JSON value. Read-only — reader writes happen via the agent.
 */
export function ReaderBibleView({ runId }: ReaderBibleViewProps) {
  const entries = useReaderBible(runId);
  const isDark = useIsDark();
  const [selected, setSelected] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(entries ?? []), [entries]);
  const selectedEntry = useMemo(() => {
    if (!selected || !entries) return null;
    return entries.find((e) => e.path === selected) ?? null;
  }, [selected, entries]);

  if (!entries) return <div className="h-full p-4 text-sm">Loading…</div>;
  if (entries.length === 0) {
    return (
      <div className="h-full p-4 text-sm text-neutral-500 dark:text-neutral-400">
        The reader hasn't recorded anything yet. Start a reading pass to
        populate the bible.
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 md:grid-cols-2">
      <div className="min-h-0 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900/50">
        <TreeNodeView
          node={tree}
          depth={0}
          selectedPath={selected}
          onSelect={setSelected}
        />
      </div>
      <div className="flex min-h-0 flex-col overflow-y-auto rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
        {selectedEntry ? (
          <>
            <h4 className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
              {selectedEntry.path}
            </h4>
            <div className="mt-2">
              <ValueView value={selectedEntry.value} isDark={isDark} />
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Select a path on the left to view its value.
          </p>
        )}
      </div>
    </div>
  );
}

function ValueView({ value, isDark }: { value: unknown; isDark: boolean }) {
  const isObjectLike = value !== null && typeof value === "object";

  if (isObjectLike) {
    return (
      <ReactJson
        src={value as object}
        name={false}
        theme={isDark ? "monokai" : "rjv-default"}
        collapsed={2}
        enableClipboard={false}
        displayDataTypes={false}
        displayObjectSize
        quotesOnKeys={false}
        style={{ background: "transparent", fontSize: "0.75rem" }}
      />
    );
  }

  return (
    <pre className="whitespace-pre-wrap break-words text-xs text-neutral-900 dark:text-neutral-100">
      {JSON.stringify(value)}
    </pre>
  );
}

function TreeNodeView({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const isSelected = node.fullPath === selectedPath;
  return (
    <div>
      {node.segment !== "" && (
        <button
          type="button"
          onClick={() => node.hasValue && onSelect(node.fullPath)}
          className={`block w-full text-left ${
            node.hasValue
              ? "cursor-pointer hover:text-primary-600 dark:hover:text-primary-400"
              : "cursor-default text-neutral-700 dark:text-neutral-300"
          } ${isSelected ? "font-semibold text-primary-600 dark:text-primary-400" : ""}`}
          style={{ paddingLeft: `${depth * 12}px` }}
        >
          {node.segment}
          {node.hasValue && <span className="ml-1 text-neutral-400">●</span>}
        </button>
      )}
      {node.children.map((child) => (
        <TreeNodeView
          key={child.fullPath}
          node={child}
          depth={depth + (node.segment === "" ? 0 : 1)}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function buildTree(entries: { path: string; value: unknown }[]): TreeNode {
  const root: TreeNode = {
    segment: "",
    fullPath: "",
    children: [],
    value: null,
    hasValue: false,
  };
  const byPath = new Map<string, TreeNode>([["", root]]);

  for (const entry of entries) {
    const segments = entry.path.split("/");
    let parentPath = "";
    let parent = root;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const fullPath = parentPath ? `${parentPath}/${seg}` : seg;
      let node = byPath.get(fullPath);
      if (!node) {
        node = {
          segment: seg,
          fullPath,
          children: [],
          value: null,
          hasValue: false,
        };
        byPath.set(fullPath, node);
        parent.children.push(node);
      }
      if (i === segments.length - 1) {
        node.value = entry.value;
        node.hasValue = true;
      }
      parent = node;
      parentPath = fullPath;
    }
  }

  // Sort children alphabetically.
  const sortRecursive = (n: TreeNode) => {
    n.children.sort((a, b) => a.segment.localeCompare(b.segment));
    n.children.forEach(sortRecursive);
  };
  sortRecursive(root);

  return root;
}
