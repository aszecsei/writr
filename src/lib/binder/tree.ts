import type { Chapter, ChapterId, ChapterSection } from "@/db/schemas";
import { countHoles, type HoleDelimiters } from "@/lib/holes";

/** A chapter together with its nested children, as rendered in the binder. */
export interface BinderNode {
  chapter: Chapter;
  children: BinderNode[];
}

/** A chapter flattened out of the tree, carrying its nesting depth (root = 0). */
export interface FlatBinderNode {
  chapter: Chapter;
  depth: number;
}

/**
 * A row as drawn in the binder, flattened for drag-and-drop. Carries its current
 * `depth` and `parentId` so horizontal-projection logic can reposition it.
 */
export interface FlatRow {
  /** Mirrors `chapter.id`; the `move()` helper and sortables key rows by `id`. */
  id: ChapterId;
  chapter: Chapter;
  depth: number;
  parentId: ChapterId | null;
  hasChildren: boolean;
}

/**
 * Assemble the flat chapter rows of one section into a nested tree, with each
 * sibling group sorted by `order`.
 *
 * Robustness: a row whose `parentChapterId` does not resolve to another row in
 * the same section is treated as a root, so a dangling parent reference can
 * never hide a document from the binder.
 */
export function buildTree(
  items: Chapter[],
  section: ChapterSection,
): BinderNode[] {
  // Default-tolerant: a row with no section (legacy / unmigrated) is manuscript.
  const inSection = items.filter(
    (c) => (c.section ?? "manuscript") === section,
  );
  const present = new Set(inSection.map((c) => c.id));

  const childrenOf = new Map<ChapterId | null, Chapter[]>();
  for (const c of inSection) {
    const parent =
      c.parentChapterId && present.has(c.parentChapterId)
        ? c.parentChapterId
        : null;
    const bucket = childrenOf.get(parent);
    if (bucket) bucket.push(c);
    else childrenOf.set(parent, [c]);
  }

  const build = (parent: ChapterId | null): BinderNode[] =>
    (childrenOf.get(parent) ?? [])
      .sort((a, b) => a.order - b.order)
      .map((chapter) => ({ chapter, children: build(chapter.id) }));

  return build(null);
}

/**
 * Depth-first preorder of the manuscript tree: a node appears immediately before
 * its children (the compile order — parent prose, then nested scenes). Scratchpad
 * rows are excluded.
 */
export function flattenManuscript(items: Chapter[]): FlatBinderNode[] {
  const out: FlatBinderNode[] = [];
  const walk = (nodes: BinderNode[], depth: number): void => {
    for (const node of nodes) {
      out.push({ chapter: node.chapter, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(buildTree(items, "manuscript"), 0);
  return out;
}

/**
 * Map each manuscript row to its position in the flattened depth-first sequence.
 * This is the canonical "manuscript position" once nesting makes raw `order`
 * sibling-scoped — used for reader-pass gating, outline-row order, and export.
 */
export function manuscriptIndexMap(items: Chapter[]): Map<ChapterId, number> {
  const map = new Map<ChapterId, number>();
  flattenManuscript(items).forEach((node, index) => {
    map.set(node.chapter.id, index);
  });
  return map;
}

/**
 * Flatten a tree into the ordered rows actually drawn (honoring collapse), each
 * tagged with its `depth` and `parentId` for drag projection.
 *
 * Two kinds of collapse:
 *  - A collapsed document hides its own descendants.
 *  - A collapsed separator hides the siblings that follow it in its group, up to
 *    the next separator (or the end of the group) — collapsing an "act". This
 *    works whether or not those siblings are themselves nested.
 */
export function flattenForDnd(
  nodes: BinderNode[],
  collapsed: Record<string, boolean>,
): FlatRow[] {
  const out: FlatRow[] = [];
  const push = (
    node: BinderNode,
    depth: number,
    parentId: ChapterId | null,
  ): void => {
    out.push({
      id: node.chapter.id,
      chapter: node.chapter,
      depth,
      parentId,
      hasChildren: node.children.length > 0,
    });
  };
  const walk = (
    list: BinderNode[],
    depth: number,
    parentId: ChapterId | null,
  ): void => {
    // While a preceding separator in this group is collapsed, its following
    // siblings are hidden until the next separator resets the run.
    let hiddenBySeparator = false;
    for (const node of list) {
      const isSeparator = node.chapter.kind === "separator";
      if (isSeparator) {
        push(node, depth, parentId);
        const sepCollapsed = collapsed[node.chapter.id] === true;
        hiddenBySeparator = sepCollapsed;
        if (node.children.length > 0 && !sepCollapsed) {
          walk(node.children, depth + 1, node.chapter.id);
        }
        continue;
      }
      if (hiddenBySeparator) continue;
      push(node, depth, parentId);
      if (node.children.length > 0 && collapsed[node.chapter.id] !== true) {
        walk(node.children, depth + 1, node.chapter.id);
      }
    }
  };
  walk(nodes, 0, null);
  return out;
}

/** Ids of every descendant of `id` within a flattened drag list. */
export function flatDescendantIds(
  rows: FlatRow[],
  id: ChapterId,
): Set<ChapterId> {
  const result = new Set<ChapterId>();
  const addChildren = (parentId: ChapterId): void => {
    for (const row of rows) {
      if (row.parentId === parentId) {
        result.add(row.chapter.id);
        addChildren(row.chapter.id);
      }
    }
  };
  addChildren(id);
  return result;
}

/** Levels of nesting implied by a horizontal drag offset. */
export function getDragDepth(offset: number, indentation: number): number {
  return Math.round(offset / indentation);
}

/**
 * Project a dragged row's `{ depth, parentId }` from its position in the
 * flattened list and a desired depth — ported from the dnd-kit Sortable/Tree
 * example. Depth is clamped to one level deeper than the row above and no
 * shallower than the row below; the parent is derived from the row above.
 */
export function getBinderProjection(
  rows: FlatRow[],
  draggedId: ChapterId,
  projectedDepth: number,
): { depth: number; parentId: ChapterId | null } {
  const index = rows.findIndex((r) => r.chapter.id === draggedId);
  const previous = rows[index - 1];
  const next = rows[index + 1];
  const maxDepth = previous ? previous.depth + 1 : 0;
  const minDepth = next ? next.depth : 0;

  let depth = projectedDepth;
  if (projectedDepth >= maxDepth) depth = maxDepth;
  else if (projectedDepth < minDepth) depth = minDepth;

  const parentId = (() => {
    if (depth === 0 || !previous) return null;
    if (depth === previous.depth) return previous.parentId;
    if (depth > previous.depth) return previous.chapter.id;
    return (
      rows
        .slice(0, index)
        .reverse()
        .find((r) => r.depth === depth)?.parentId ?? null
    );
  })();

  return { depth, parentId };
}

/** Map every row to its nesting depth (root = 0), across both sections. */
export function depthMap(items: Chapter[]): Map<ChapterId, number> {
  const byId = new Map<ChapterId, Chapter>(items.map((c) => [c.id, c]));
  const cache = new Map<ChapterId, number>();

  const depthOf = (id: ChapterId): number => {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    let depth = 0;
    const seen = new Set<ChapterId>();
    let cursor = byId.get(id)?.parentChapterId ?? null;
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      depth++;
      cursor = byId.get(cursor)?.parentChapterId ?? null;
    }
    cache.set(id, depth);
    return depth;
  };

  const map = new Map<ChapterId, number>();
  for (const c of items) map.set(c.id, depthOf(c.id));
  return map;
}

/**
 * A row that participates in the manuscript: a real document (not a separator)
 * in the manuscript section (not scratchpad). Exclusion-based so rows predating
 * the binder fields (treated as their defaults) still count.
 */
export function isManuscriptDocument(
  chapter: Pick<Chapter, "section" | "kind">,
): boolean {
  return chapter.section !== "scratchpad" && chapter.kind !== "separator";
}

/**
 * Total per-node value of each node's subtree (the node's own value plus every
 * descendant's), via a caller-supplied per-chapter count.
 */
function subtreeCounts(
  nodes: BinderNode[],
  countOf: (chapter: Chapter) => number,
): Map<ChapterId, number> {
  const map = new Map<ChapterId, number>();
  const visit = (node: BinderNode): number => {
    let total = countOf(node.chapter);
    for (const child of node.children) total += visit(child);
    map.set(node.chapter.id, total);
    return total;
  };
  for (const node of nodes) visit(node);
  return map;
}

/**
 * Total word count of each node's subtree (the node's own `wordCount` plus every
 * descendant's). Used for the binder's folder rollup display.
 */
export function subtreeWordCounts(nodes: BinderNode[]): Map<ChapterId, number> {
  return subtreeCounts(nodes, (chapter) => chapter.wordCount);
}

/**
 * Total hole count of each node's subtree (the node's own holes plus every
 * descendant's). Holes are bracketed placeholder sections — see
 * `src/lib/holes.ts`. Computed on the fly from `chapter.content` (no persisted
 * field), mirroring `subtreeWordCounts`.
 */
export function subtreeHoleCounts(
  nodes: BinderNode[],
  delimiters: HoleDelimiters,
): Map<ChapterId, number> {
  return subtreeCounts(nodes, (chapter) =>
    countHoles(chapter.content, delimiters),
  );
}

/** The given node plus every descendant, regardless of section (for cascade ops). */
export function subtreeIds(items: Chapter[], id: ChapterId): Set<ChapterId> {
  const childrenOf = new Map<ChapterId, ChapterId[]>();
  for (const c of items) {
    if (!c.parentChapterId) continue;
    const bucket = childrenOf.get(c.parentChapterId);
    if (bucket) bucket.push(c.id);
    else childrenOf.set(c.parentChapterId, [c.id]);
  }

  const result = new Set<ChapterId>();
  const stack: ChapterId[] = [id];
  while (stack.length > 0) {
    const current = stack.pop() as ChapterId;
    if (result.has(current)) continue;
    result.add(current);
    for (const child of childrenOf.get(current) ?? []) stack.push(child);
  }
  return result;
}

/**
 * Would re-parenting `id` under `newParentId` create a cycle? True when the new
 * parent is the node itself or any of its descendants. Moving to the root
 * (`null`) is always safe.
 */
export function wouldCreateCycle(
  items: Chapter[],
  id: ChapterId,
  newParentId: ChapterId | null,
): boolean {
  if (newParentId === null) return false;
  if (newParentId === id) return true;

  const byId = new Map<ChapterId, Chapter>(items.map((c) => [c.id, c]));
  const seen = new Set<ChapterId>();
  let cursor: ChapterId | null = newParentId;
  while (cursor && !seen.has(cursor)) {
    if (cursor === id) return true;
    seen.add(cursor);
    cursor = byId.get(cursor)?.parentChapterId ?? null;
  }
  return false;
}
