import type { Chapter, ChapterId } from "@/db/schemas";
import { type BinderNode, buildTree, isManuscriptDocument } from "./tree";

/**
 * A slice of the manuscript an analysis can be confined to — the whole
 * project, one story in a collection, or one document — so stories in
 * the same project don't bleed into each other.
 */
export interface ComparisonContext {
  id: string;
  kind: "project" | "subtree" | "separatorGroup" | "document";
  /** Row title; empty for the project context (the caller labels it). */
  title: string;
  depth: number;
  /** Manuscript documents in reading order. */
  chapterIds: ChapterId[];
}

function documentsIn(nodes: readonly BinderNode[], out: ChapterId[]): void {
  for (const node of nodes) {
    if (isManuscriptDocument(node.chapter)) out.push(node.chapter.id);
    documentsIn(node.children, out);
  }
}

function documentIds(nodes: readonly BinderNode[]): ChapterId[] {
  const out: ChapterId[] = [];
  documentsIn(nodes, out);
  return out;
}

/**
 * The separator-delimited groups in one sibling list: each separator owns
 * its own children plus the siblings after it, up to the next separator —
 * the same run a collapsed separator hides in the binder.
 */
function separatorGroups(
  list: readonly BinderNode[],
): Map<ChapterId, BinderNode[]> {
  const groups = new Map<ChapterId, BinderNode[]>();
  let current: BinderNode[] | null = null;
  for (const node of list) {
    if (node.chapter.kind === "separator") {
      current = [...node.children];
      groups.set(node.chapter.id, current);
    } else if (current) {
      current.push(node);
    }
  }
  return groups;
}

/**
 * Every context the manuscript offers, project first, then in binder order:
 * each separator group, each row with nested documents (its subtree), and
 * each top-level document on its own (for collections where one document
 * is one story). Contexts covering the same documents as an earlier one
 * are dropped.
 */
export function listComparisonContexts(items: Chapter[]): ComparisonContext[] {
  const roots = buildTree(items, "manuscript");
  const contexts: ComparisonContext[] = [];
  const seen = new Set<string>();

  const add = (context: ComparisonContext): void => {
    if (context.chapterIds.length === 0) return;
    const key = context.chapterIds.join(",");
    if (seen.has(key)) return;
    seen.add(key);
    contexts.push(context);
  };

  add({
    id: "project",
    kind: "project",
    title: "",
    depth: 0,
    chapterIds: documentIds(roots),
  });

  const walk = (list: readonly BinderNode[], depth: number): void => {
    const groups = separatorGroups(list);
    for (const node of list) {
      const { chapter } = node;
      const group = groups.get(chapter.id);
      if (group) {
        add({
          id: `group:${chapter.id}`,
          kind: "separatorGroup",
          title: chapter.title,
          depth,
          chapterIds: documentIds(group),
        });
        walk(node.children, depth + 1);
        continue;
      }
      if (node.children.length > 0) {
        add({
          id: `subtree:${chapter.id}`,
          kind: "subtree",
          title: chapter.title,
          depth,
          chapterIds: documentIds([node]),
        });
        walk(node.children, depth + 1);
      } else if (depth === 0 && isManuscriptDocument(chapter)) {
        add({
          id: `document:${chapter.id}`,
          kind: "document",
          title: chapter.title,
          depth,
          chapterIds: [chapter.id],
        });
      }
    }
  };
  walk(roots, 0);

  return contexts;
}
