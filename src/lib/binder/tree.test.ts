import { describe, expect, it } from "vitest";
import type { Chapter, ChapterId, ProjectId } from "@/db/schemas";
import { makeChapter } from "@/test/helpers";
import {
  buildTree,
  depthMap,
  type FlatRow,
  flattenForDnd,
  flattenManuscript,
  getBinderProjection,
  getDragDepth,
  isManuscriptDocument,
  manuscriptIndexMap,
  subtreeIds,
  subtreeWordCounts,
  wouldCreateCycle,
} from "./tree";

const PROJECT_ID = "00000000-0000-4000-8000-0000000000aa" as ProjectId;

function ch(id: string, overrides: Partial<Chapter> = {}): Chapter {
  return makeChapter({
    projectId: PROJECT_ID,
    title: id,
    id: id as ChapterId,
    ...overrides,
  });
}

// A shared fixture, intentionally inserted out of order to exercise sorting.
//   A (0)               [manuscript]
//   ├─ A1 (0)
//   └─ A2 (1)
//      └─ A2a (0)
//   SEP (1, separator)
//   B (2)
//   └─ B1 (0)
//   S (0)               [scratchpad root]
//   └─ S1 (0)
function fixture(): Chapter[] {
  return [
    ch("B1", { parentChapterId: "B" as ChapterId, order: 0 }),
    ch("A2a", { parentChapterId: "A2" as ChapterId, order: 0 }),
    ch("SEP", { order: 1, kind: "separator" }),
    ch("A", { order: 0 }),
    ch("B", { order: 2 }),
    ch("A2", { parentChapterId: "A" as ChapterId, order: 1 }),
    ch("A1", { parentChapterId: "A" as ChapterId, order: 0 }),
    ch("S1", {
      parentChapterId: "S" as ChapterId,
      order: 0,
      section: "scratchpad",
    }),
    ch("S", { order: 0, section: "scratchpad" }),
  ];
}

function ids(nodes: { chapter: Chapter }[]): string[] {
  return nodes.map((n) => n.chapter.id);
}

describe("buildTree", () => {
  it("nests children under parents, sorted by sibling order", () => {
    const tree = buildTree(fixture(), "manuscript");
    expect(tree.map((n) => n.chapter.id)).toEqual(["A", "SEP", "B"]);
    const a = tree[0];
    expect(a.children.map((n) => n.chapter.id)).toEqual(["A1", "A2"]);
    expect(a.children[1].children.map((n) => n.chapter.id)).toEqual(["A2a"]);
  });

  it("isolates sections from one another", () => {
    const scratch = buildTree(fixture(), "scratchpad");
    expect(scratch.map((n) => n.chapter.id)).toEqual(["S"]);
    expect(scratch[0].children.map((n) => n.chapter.id)).toEqual(["S1"]);
  });

  it("treats an item whose parent is absent from the section as a root", () => {
    const orphan = [
      ch("X", { parentChapterId: "ghost" as ChapterId, order: 0 }),
    ];
    const tree = buildTree(orphan, "manuscript");
    expect(tree.map((n) => n.chapter.id)).toEqual(["X"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(buildTree([], "manuscript")).toEqual([]);
  });
});

describe("flattenManuscript", () => {
  it("emits manuscript rows depth-first, parent before children, with depth", () => {
    const flat = flattenManuscript(fixture());
    expect(ids(flat)).toEqual(["A", "A1", "A2", "A2a", "SEP", "B", "B1"]);
    expect(flat.map((n) => n.depth)).toEqual([0, 1, 1, 2, 0, 0, 1]);
  });

  it("excludes scratchpad rows entirely", () => {
    const flat = flattenManuscript(fixture());
    expect(ids(flat)).not.toContain("S");
    expect(ids(flat)).not.toContain("S1");
  });
});

describe("manuscriptIndexMap", () => {
  it("assigns the flattened depth-first position to each manuscript row", () => {
    const map = manuscriptIndexMap(fixture());
    expect(map.get("A" as ChapterId)).toBe(0);
    expect(map.get("A2a" as ChapterId)).toBe(3);
    expect(map.get("SEP" as ChapterId)).toBe(4);
    expect(map.get("B1" as ChapterId)).toBe(6);
    expect(map.has("S" as ChapterId)).toBe(false);
  });
});

describe("depthMap", () => {
  it("reports 0 for roots and increments per level", () => {
    const map = depthMap(fixture());
    expect(map.get("A" as ChapterId)).toBe(0);
    expect(map.get("A1" as ChapterId)).toBe(1);
    expect(map.get("A2a" as ChapterId)).toBe(2);
    expect(map.get("S1" as ChapterId)).toBe(1);
  });
});

describe("subtreeIds", () => {
  it("returns the node and all of its descendants", () => {
    const set = subtreeIds(fixture(), "A" as ChapterId);
    expect([...set].sort()).toEqual(["A", "A1", "A2", "A2a"]);
  });

  it("returns just the node for a leaf", () => {
    const set = subtreeIds(fixture(), "B1" as ChapterId);
    expect([...set]).toEqual(["B1"]);
  });
});

describe("flattenForDnd", () => {
  it("omits the children of collapsed nodes", () => {
    const items = [
      ch("A", { order: 0 }),
      ch("A1", { parentChapterId: "A" as ChapterId, order: 0 }),
      ch("B", { order: 1 }),
    ];
    const nodes = buildTree(items, "manuscript");
    const rows = flattenForDnd(nodes, { A: true });
    expect(rows.map((r) => r.chapter.id)).toEqual(["A", "B"]);
  });

  it("tags each row with depth, parentId, and hasChildren", () => {
    const items = [
      ch("A", { order: 0 }),
      ch("A1", { parentChapterId: "A" as ChapterId, order: 0 }),
    ];
    const rows = flattenForDnd(buildTree(items, "manuscript"), {});
    expect(rows).toEqual([
      expect.objectContaining({ depth: 0, parentId: null, hasChildren: true }),
      expect.objectContaining({ depth: 1, parentId: "A", hasChildren: false }),
    ]);
  });

  it("hides chapters after a collapsed separator, up to the next separator", () => {
    const items = [
      ch("SEP1", { order: 0, kind: "separator" }),
      ch("A", { order: 1 }),
      ch("B", { order: 2 }),
      ch("SEP2", { order: 3, kind: "separator" }),
      ch("C", { order: 4 }),
    ];
    const rows = flattenForDnd(buildTree(items, "manuscript"), { SEP1: true });
    expect(rows.map((r) => r.chapter.id)).toEqual(["SEP1", "SEP2", "C"]);
  });

  it("hides nested subtrees of siblings under a collapsed separator", () => {
    const items = [
      ch("SEP1", { order: 0, kind: "separator" }),
      ch("A", { order: 1 }),
      ch("A1", { parentChapterId: "A" as ChapterId, order: 0 }),
      ch("SEP2", { order: 2, kind: "separator" }),
    ];
    const rows = flattenForDnd(buildTree(items, "manuscript"), { SEP1: true });
    expect(rows.map((r) => r.chapter.id)).toEqual(["SEP1", "SEP2"]);
  });
});

describe("getDragDepth", () => {
  it("rounds a horizontal offset to whole indentation levels", () => {
    expect(getDragDepth(0, 24)).toBe(0);
    expect(getDragDepth(30, 24)).toBe(1);
    expect(getDragDepth(-30, 24)).toBe(-1);
  });
});

describe("getBinderProjection", () => {
  function fr(id: string, depth: number, parentId: string | null): FlatRow {
    return {
      id: id as ChapterId,
      chapter: ch(id, {}),
      depth,
      parentId: parentId as ChapterId | null,
      hasChildren: false,
    };
  }

  // The dragged row "DRAG" sits between A1 (a child of A) and B (a root).
  const rows = [
    fr("A", 0, null),
    fr("A1", 1, "A"),
    fr("DRAG", 1, "A"),
    fr("B", 0, null),
  ];

  it("nests under the row above when projected one level deeper", () => {
    expect(getBinderProjection(rows, "DRAG" as ChapterId, 2)).toEqual({
      depth: 2,
      parentId: "A1",
    });
  });

  it("stays a sibling of the row above at the same depth", () => {
    expect(getBinderProjection(rows, "DRAG" as ChapterId, 1)).toEqual({
      depth: 1,
      parentId: "A",
    });
  });

  it("outdents to the top level when projected shallow", () => {
    expect(getBinderProjection(rows, "DRAG" as ChapterId, 0)).toEqual({
      depth: 0,
      parentId: null,
    });
  });

  it("clamps depth to at most one level below the row above", () => {
    expect(getBinderProjection(rows, "DRAG" as ChapterId, 9)).toEqual({
      depth: 2,
      parentId: "A1",
    });
  });

  it("clamps depth to no shallower than the row below", () => {
    // [ A(0), A1(1,folder), A1a(2), DRAG(2), A2(1) ] — below is A2 at depth 1.
    const clampRows = [
      fr("A", 0, null),
      fr("A1", 1, "A"),
      fr("A1a", 2, "A1"),
      fr("DRAG", 2, "A1"),
      fr("A2", 1, "A"),
    ];
    expect(getBinderProjection(clampRows, "DRAG" as ChapterId, 0)).toEqual({
      depth: 1,
      parentId: "A",
    });
  });
});

describe("isManuscriptDocument", () => {
  it("accepts manuscript documents and rejects separators / scratchpad", () => {
    expect(
      isManuscriptDocument({ section: "manuscript", kind: "document" }),
    ).toBe(true);
    expect(
      isManuscriptDocument({ section: "manuscript", kind: "separator" }),
    ).toBe(false);
    expect(
      isManuscriptDocument({ section: "scratchpad", kind: "document" }),
    ).toBe(false);
  });
});

describe("subtreeWordCounts", () => {
  it("sums each node's own count plus all descendants", () => {
    const items = [
      ch("A", { order: 0, wordCount: 100 }),
      ch("A1", { parentChapterId: "A" as ChapterId, order: 0, wordCount: 30 }),
      ch("A2", { parentChapterId: "A" as ChapterId, order: 1, wordCount: 20 }),
      ch("A2a", {
        parentChapterId: "A2" as ChapterId,
        order: 0,
        wordCount: 5,
      }),
    ];
    const map = subtreeWordCounts(buildTree(items, "manuscript"));
    expect(map.get("A" as ChapterId)).toBe(155); // 100 + 30 + 20 + 5
    expect(map.get("A2" as ChapterId)).toBe(25); // 20 + 5
    expect(map.get("A1" as ChapterId)).toBe(30);
    expect(map.get("A2a" as ChapterId)).toBe(5);
  });
});

describe("wouldCreateCycle", () => {
  const items = fixture();
  it("rejects making a node its own parent", () => {
    expect(wouldCreateCycle(items, "A" as ChapterId, "A" as ChapterId)).toBe(
      true,
    );
  });
  it("rejects moving a node under one of its descendants", () => {
    expect(wouldCreateCycle(items, "A" as ChapterId, "A2a" as ChapterId)).toBe(
      true,
    );
  });
  it("allows moving under an unrelated node", () => {
    expect(wouldCreateCycle(items, "A" as ChapterId, "B" as ChapterId)).toBe(
      false,
    );
  });
  it("allows moving to the root", () => {
    expect(wouldCreateCycle(items, "A2" as ChapterId, null)).toBe(false);
  });
});
