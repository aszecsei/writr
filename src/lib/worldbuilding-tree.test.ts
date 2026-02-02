import { describe, expect, it } from "vitest";
import { makeWorldbuildingDoc } from "@/test/helpers";
import {
  buildWorldbuildingTree,
  compileWorldbuildingToMarkdown,
} from "./worldbuilding-tree";

const pid = "00000000-0000-4000-8000-000000000001";

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
      id: "00000000-0000-4000-8000-aaaaaaaaaaaa",
      projectId: pid,
      title: "Parent",
    });
    const child = makeWorldbuildingDoc({
      projectId: pid,
      title: "Child",
      parentDocId: "00000000-0000-4000-8000-aaaaaaaaaaaa",
    });
    const tree = buildWorldbuildingTree([parent, child]);
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children).toHaveLength(1);
    expect(tree.roots[0].children[0].doc.title).toBe("Child");
    expect(tree.roots[0].children[0].depth).toBe(1);
  });

  it("handles 3-level depth", () => {
    const root = makeWorldbuildingDoc({
      id: "00000000-0000-4000-8000-aaaaaaaaaaaa",
      projectId: pid,
      title: "Root",
    });
    const mid = makeWorldbuildingDoc({
      id: "00000000-0000-4000-8000-bbbbbbbbbbbb",
      projectId: pid,
      title: "Mid",
      parentDocId: "00000000-0000-4000-8000-aaaaaaaaaaaa",
    });
    const leaf = makeWorldbuildingDoc({
      projectId: pid,
      title: "Leaf",
      parentDocId: "00000000-0000-4000-8000-bbbbbbbbbbbb",
    });
    const tree = buildWorldbuildingTree([root, mid, leaf]);
    expect(tree.roots[0].depth).toBe(0);
    expect(tree.roots[0].children[0].depth).toBe(1);
    expect(tree.roots[0].children[0].children[0].depth).toBe(2);
  });

  it("sorts multiple children within parent by order", () => {
    const parent = makeWorldbuildingDoc({
      id: "00000000-0000-4000-8000-aaaaaaaaaaaa",
      projectId: pid,
      title: "Parent",
    });
    const c2 = makeWorldbuildingDoc({
      projectId: pid,
      title: "Second",
      parentDocId: "00000000-0000-4000-8000-aaaaaaaaaaaa",
      order: 1,
    });
    const c1 = makeWorldbuildingDoc({
      projectId: pid,
      title: "First",
      parentDocId: "00000000-0000-4000-8000-aaaaaaaaaaaa",
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
      parentDocId: "00000000-0000-4000-8000-ffffffffffff",
    });
    const tree = buildWorldbuildingTree([orphan]);
    expect(tree.roots).toHaveLength(0);
  });

  describe("cycle detection", () => {
    it("handles mutual parent references (A->B, B->A)", () => {
      const a = makeWorldbuildingDoc({
        id: "00000000-0000-4000-8000-aaaaaaaaaaaa",
        projectId: pid,
        title: "A",
        parentDocId: "00000000-0000-4000-8000-bbbbbbbbbbbb",
      });
      const b = makeWorldbuildingDoc({
        id: "00000000-0000-4000-8000-bbbbbbbbbbbb",
        projectId: pid,
        title: "B",
        parentDocId: "00000000-0000-4000-8000-aaaaaaaaaaaa",
      });
      // Neither has parentDocId=null so neither is a root
      const tree = buildWorldbuildingTree([a, b]);
      expect(tree.roots).toHaveLength(0);
    });

    it("handles self-referential doc", () => {
      const doc = makeWorldbuildingDoc({
        id: "00000000-0000-4000-8000-aaaaaaaaaaaa",
        projectId: pid,
        title: "Self",
        parentDocId: "00000000-0000-4000-8000-aaaaaaaaaaaa",
      });
      const tree = buildWorldbuildingTree([doc]);
      expect(tree.roots).toHaveLength(0);
    });
  });
});

describe("compileWorldbuildingToMarkdown", () => {
  it("increments heading depth with nesting", () => {
    const root = makeWorldbuildingDoc({
      id: "00000000-0000-4000-8000-aaaaaaaaaaaa",
      projectId: pid,
      title: "Root",
      content: "Root content",
    });
    const child = makeWorldbuildingDoc({
      projectId: pid,
      title: "Child",
      content: "Child content",
      parentDocId: "00000000-0000-4000-8000-aaaaaaaaaaaa",
    });
    const tree = buildWorldbuildingTree([root, child]);
    const md = compileWorldbuildingToMarkdown(tree);
    expect(md).toContain("# Root");
    expect(md).toContain("## Child");
  });

  it("caps heading depth at h6 for deep trees", () => {
    // Build a 7-level deep tree
    const docs = [];
    let parentId: string | null = null;
    for (let i = 0; i < 7; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
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
