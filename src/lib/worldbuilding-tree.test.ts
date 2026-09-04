import { describe, expect, it } from "vitest";
import type { ProjectId, WorldbuildingDocId } from "@/db/schemas";
import { makeWorldbuildingDoc } from "@/test/helpers";
import {
  buildWorldbuildingTree,
  compileWorldbuildingToMarkdown,
  descendantIds,
  isDescendant,
} from "./worldbuilding-tree";

const pid = "00000000-0000-4000-8000-000000000001" as ProjectId;
const idA = "00000000-0000-4000-8000-aaaaaaaaaaaa" as WorldbuildingDocId;
const idB = "00000000-0000-4000-8000-bbbbbbbbbbbb" as WorldbuildingDocId;

describe("buildWorldbuildingTree", () => {
  it("returns empty roots for empty array", () => {
    const tree = buildWorldbuildingTree([]);
    expect(tree.roots).toEqual([]);
  });

  it("places a single root doc", () => {
    const doc = makeWorldbuildingDoc({ projectId: pid, title: "Root" });
    const tree = buildWorldbuildingTree([doc]);
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].doc).toBe(doc);
    expect(tree.roots[0].depth).toBe(0);
    expect(tree.roots[0].children).toEqual([]);
  });

  it("sorts multiple roots by order", () => {
    const b = makeWorldbuildingDoc({
      projectId: pid,
      title: "B",
      order: 1,
    });
    const a = makeWorldbuildingDoc({
      projectId: pid,
      title: "A",
      order: 0,
    });
    const tree = buildWorldbuildingTree([b, a]);
    expect(tree.roots[0].doc.title).toBe("A");
    expect(tree.roots[1].doc.title).toBe("B");
  });

  it("nests parent-child relationships", () => {
    const parent = makeWorldbuildingDoc({
      id: idA,
      projectId: pid,
      title: "Parent",
    });
    const child = makeWorldbuildingDoc({
      projectId: pid,
      title: "Child",
      parentDocId: idA,
    });
    const tree = buildWorldbuildingTree([parent, child]);
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children).toHaveLength(1);
    expect(tree.roots[0].children[0].doc.title).toBe("Child");
    expect(tree.roots[0].children[0].depth).toBe(1);
  });

  it("handles 3-level depth", () => {
    const root = makeWorldbuildingDoc({
      id: idA,
      projectId: pid,
      title: "Root",
    });
    const mid = makeWorldbuildingDoc({
      id: idB,
      projectId: pid,
      title: "Mid",
      parentDocId: idA,
    });
    const leaf = makeWorldbuildingDoc({
      projectId: pid,
      title: "Leaf",
      parentDocId: idB,
    });
    const tree = buildWorldbuildingTree([root, mid, leaf]);
    expect(tree.roots[0].depth).toBe(0);
    expect(tree.roots[0].children[0].depth).toBe(1);
    expect(tree.roots[0].children[0].children[0].depth).toBe(2);
  });

  it("sorts multiple children within parent by order", () => {
    const parent = makeWorldbuildingDoc({
      id: idA,
      projectId: pid,
      title: "Parent",
    });
    const c2 = makeWorldbuildingDoc({
      projectId: pid,
      title: "Second",
      parentDocId: idA,
      order: 1,
    });
    const c1 = makeWorldbuildingDoc({
      projectId: pid,
      title: "First",
      parentDocId: idA,
      order: 0,
    });
    const tree = buildWorldbuildingTree([parent, c2, c1]);
    expect(tree.roots[0].children[0].doc.title).toBe("First");
    expect(tree.roots[0].children[1].doc.title).toBe("Second");
  });

  it("excludes orphaned children with missing parent ID", () => {
    const orphan = makeWorldbuildingDoc({
      projectId: pid,
      title: "Orphan",
      parentDocId: "00000000-0000-4000-8000-ffffffffffff" as WorldbuildingDocId,
    });
    const tree = buildWorldbuildingTree([orphan]);
    expect(tree.roots).toHaveLength(0);
  });

  describe("cycle detection", () => {
    it("handles mutual parent references (A->B, B->A)", () => {
      const a = makeWorldbuildingDoc({
        id: idA,
        projectId: pid,
        title: "A",
        parentDocId: idB,
      });
      const b = makeWorldbuildingDoc({
        id: idB,
        projectId: pid,
        title: "B",
        parentDocId: idA,
      });
      // Neither has parentDocId=null so neither is a root
      const tree = buildWorldbuildingTree([a, b]);
      expect(tree.roots).toHaveLength(0);
    });

    it("handles self-referential doc", () => {
      const doc = makeWorldbuildingDoc({
        id: idA,
        projectId: pid,
        title: "Self",
        parentDocId: idA,
      });
      const tree = buildWorldbuildingTree([doc]);
      expect(tree.roots).toHaveLength(0);
    });
  });
});

describe("compileWorldbuildingToMarkdown", () => {
  it("increments heading depth with nesting", () => {
    const root = makeWorldbuildingDoc({
      id: idA,
      projectId: pid,
      title: "Root",
      content: "Root content",
    });
    const child = makeWorldbuildingDoc({
      projectId: pid,
      title: "Child",
      content: "Child content",
      parentDocId: idA,
    });
    const tree = buildWorldbuildingTree([root, child]);
    const md = compileWorldbuildingToMarkdown(tree);
    expect(md).toContain("# Root");
    expect(md).toContain("## Child");
  });

  it("caps heading depth at h6 for deep trees", () => {
    // Build a 7-level deep tree
    const docs = [];
    let parentId: WorldbuildingDocId | null = null;
    for (let i = 0; i < 7; i++) {
      const id =
        `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` as WorldbuildingDocId;
      docs.push(
        makeWorldbuildingDoc({
          id,
          projectId: pid,
          title: `Level ${i}`,
          content: `Content ${i}`,
          parentDocId: parentId,
        }),
      );
      parentId = id;
    }
    const tree = buildWorldbuildingTree(docs);
    const md = compileWorldbuildingToMarkdown(tree);
    // Depth 5 (0-indexed) → heading 6, depth 6 → still capped at 6
    expect(md).toContain("###### Level 5");
    expect(md).toContain("###### Level 6");
    // Should NOT have 7 hashes
    expect(md).not.toContain("####### ");
  });

  it("omits empty content", () => {
    const doc = makeWorldbuildingDoc({
      projectId: pid,
      title: "Empty",
      content: "",
    });
    const tree = buildWorldbuildingTree([doc]);
    const md = compileWorldbuildingToMarkdown(tree);
    expect(md).toBe("# Empty");
  });

  it("trims content whitespace", () => {
    const doc = makeWorldbuildingDoc({
      projectId: pid,
      title: "Trimmed",
      content: "  spaced  ",
    });
    const tree = buildWorldbuildingTree([doc]);
    const md = compileWorldbuildingToMarkdown(tree);
    expect(md).toContain("spaced");
    expect(md).not.toContain("  spaced  ");
  });
});

describe("descendantIds", () => {
  const idC = "00000000-0000-4000-8000-cccccccccccc" as WorldbuildingDocId;

  it("returns an empty set for a leaf doc", () => {
    const doc = makeWorldbuildingDoc({ id: idA, projectId: pid, title: "A" });
    const tree = buildWorldbuildingTree([doc]);
    expect(descendantIds(tree, idA)).toEqual(new Set());
  });

  it("returns an empty set for an id not in the tree", () => {
    const doc = makeWorldbuildingDoc({ id: idA, projectId: pid, title: "A" });
    const tree = buildWorldbuildingTree([doc]);
    expect(descendantIds(tree, idB)).toEqual(new Set());
  });

  it("collects direct children", () => {
    const parent = makeWorldbuildingDoc({
      id: idA,
      projectId: pid,
      title: "Parent",
    });
    const child = makeWorldbuildingDoc({
      id: idB,
      projectId: pid,
      title: "Child",
      parentDocId: idA,
    });
    const tree = buildWorldbuildingTree([parent, child]);
    expect(descendantIds(tree, idA)).toEqual(new Set([idB]));
  });

  it("collects multi-level descendants", () => {
    const root = makeWorldbuildingDoc({
      id: idA,
      projectId: pid,
      title: "Root",
    });
    const mid = makeWorldbuildingDoc({
      id: idB,
      projectId: pid,
      title: "Mid",
      parentDocId: idA,
    });
    const leaf = makeWorldbuildingDoc({
      id: idC,
      projectId: pid,
      title: "Leaf",
      parentDocId: idB,
    });
    const tree = buildWorldbuildingTree([root, mid, leaf]);
    expect(descendantIds(tree, idA)).toEqual(new Set([idB, idC]));
    expect(descendantIds(tree, idB)).toEqual(new Set([idC]));
    expect(descendantIds(tree, idC)).toEqual(new Set());
  });
});

describe("isDescendant", () => {
  it("is true for a nested descendant and false for an unrelated doc", () => {
    const root = makeWorldbuildingDoc({
      id: idA,
      projectId: pid,
      title: "Root",
    });
    const child = makeWorldbuildingDoc({
      id: idB,
      projectId: pid,
      title: "Child",
      parentDocId: idA,
    });
    const other = makeWorldbuildingDoc({
      projectId: pid,
      title: "Other",
    });
    const tree = buildWorldbuildingTree([root, child, other]);
    expect(isDescendant(tree, idA, idB)).toBe(true);
    expect(isDescendant(tree, idA, other.id)).toBe(false);
    expect(isDescendant(tree, idB, idA)).toBe(false);
  });
});
