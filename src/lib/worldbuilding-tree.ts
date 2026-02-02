import type { WorldbuildingDoc } from "@/db/schemas";

export interface DocNode {
  doc: WorldbuildingDoc;
  depth: number;
  children: DocNode[];
}

export interface WorldbuildingTree {
  roots: DocNode[];
}

export function buildWorldbuildingTree(
  docs: WorldbuildingDoc[],
): WorldbuildingTree {
  const byParent = new Map<string | null, WorldbuildingDoc[]>();
  for (const d of docs) {
    const key = d.parentDocId;
    const arr = byParent.get(key);
    if (arr) arr.push(d);
    else byParent.set(key, [d]);
  }

  function buildNodes(
    parentId: string | null,
    depth: number,
    visited: Set<string> = new Set(),
  ): DocNode[] {
    const children = byParent.get(parentId) ?? [];
    return children
      .sort((a, b) => a.order - b.order)
      .filter((doc) => !visited.has(doc.id))
      .map((doc) => {
        visited.add(doc.id);
        return {
          doc,
          depth,
          children: buildNodes(doc.id, depth + 1, visited),
        };
      });
  }

  return { roots: buildNodes(null, 0) };
}

export function compileWorldbuildingToMarkdown(
  tree: WorldbuildingTree,
): string {
  const lines: string[] = [];

  function renderNode(node: DocNode): void {
    const headingDepth = Math.min(node.depth + 1, 6);
    const prefix = "#".repeat(headingDepth);
    lines.push(`${prefix} ${node.doc.title}`);
    lines.push("");

    if (node.doc.content.trim()) {
      lines.push(node.doc.content.trim());
      lines.push("");
    }

    for (const child of node.children) {
      renderNode(child);
    }
  }

  for (const node of tree.roots) {
    renderNode(node);
  }

  return lines.join("\n").trim();
}
