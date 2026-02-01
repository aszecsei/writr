import type { Edge, Node } from "@xyflow/react";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const NODE_SEP = 60;
const RANK_SEP = 80;

/**
 * Pure function: assigns hierarchical (top-to-bottom) positions to nodes
 * using BFS ranking, then centers each rank layer horizontally.
 */
export function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return [];

  const ids = new Set(nodes.map((n) => n.id));
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();

  for (const id of ids) {
    children.set(id, []);
    parents.set(id, []);
  }

  for (const edge of edges) {
    if (ids.has(edge.source) && ids.has(edge.target)) {
      children.get(edge.source)?.push(edge.target);
      parents.get(edge.target)?.push(edge.source);
    }
  }

  // Assign ranks via BFS from root nodes (no incoming edges)
  const rank = new Map<string, number>();
  const roots = [...ids].filter((id) => (parents.get(id)?.length ?? 0) === 0);

  // If no roots (cyclic graph), pick all nodes as rank 0 starting points
  const queue: string[] = roots.length > 0 ? [...roots] : [...ids];
  for (const r of queue) {
    if (!rank.has(r)) rank.set(r, 0);
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const currentRank = rank.get(current) ?? 0;
    for (const child of children.get(current) ?? []) {
      const existing = rank.get(child);
      if (existing === undefined || existing < currentRank + 1) {
        rank.set(child, currentRank + 1);
        queue.push(child);
      }
    }
  }

  // Handle any disconnected nodes that weren't reached
  for (const id of ids) {
    if (!rank.has(id)) rank.set(id, 0);
  }

  // Group nodes by rank
  const layers = new Map<number, string[]>();
  for (const [id, r] of rank) {
    if (!layers.has(r)) layers.set(r, []);
    layers.get(r)?.push(id);
  }

  // Assign positions: center each layer horizontally
  const positions = new Map<string, { x: number; y: number }>();
  const sortedRanks = [...layers.keys()].sort((a, b) => a - b);

  for (const r of sortedRanks) {
    const layer = layers.get(r) ?? [];
    const layerWidth =
      layer.length * NODE_WIDTH + (layer.length - 1) * NODE_SEP;
    const startX = -layerWidth / 2;
    const y = r * (NODE_HEIGHT + RANK_SEP);

    for (let i = 0; i < layer.length; i++) {
      positions.set(layer[i], {
        x: startX + i * (NODE_WIDTH + NODE_SEP),
        y,
      });
    }
  }

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? { x: 0, y: 0 },
  }));
}
