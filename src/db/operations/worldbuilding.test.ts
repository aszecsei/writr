import { beforeEach, describe, expect, it } from "vitest";
import { makeWorldbuildingDoc, resetIdCounter } from "@/test/helpers";
import { db } from "../database";
import type { ProjectId } from "../schemas";
import { getIndexedChunksBySource, putIndexedChunk } from "./indexedChunks";
import {
  createWorldbuildingDoc,
  deleteWorldbuildingDoc,
  getWorldbuildingDoc,
  updateWorldbuildingDoc,
} from "./worldbuilding";

const projectId = "b2222222-2222-4222-a222-222222222222" as ProjectId;

function chunk(sourceId: string, chunkIndex: number) {
  return {
    projectId,
    sourceType: "worldbuilding" as const,
    sourceId,
    chunkIndex,
    text: `t${chunkIndex}`,
    contentHash: `h${chunkIndex}`,
    vector: [0.1, 0.2],
    embeddingModel: "fake-v1",
  };
}

describe("deleteWorldbuildingDoc", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.worldbuildingDocs.clear();
    await db.indexedChunks.clear();
  });

  it("prunes the deleted doc's indexed chunks", async () => {
    const doc = makeWorldbuildingDoc({ projectId, title: "Lore" });
    await db.worldbuildingDocs.add(doc);
    await putIndexedChunk(chunk(doc.id, 0));
    await putIndexedChunk(chunk(doc.id, 1));

    await deleteWorldbuildingDoc(doc.id);

    expect(
      await getIndexedChunksBySource(projectId, "worldbuilding", doc.id),
    ).toHaveLength(0);
  });

  it("leaves sibling docs' chunks intact", async () => {
    const a = makeWorldbuildingDoc({ projectId, title: "A" });
    const b = makeWorldbuildingDoc({ projectId, title: "B" });
    await db.worldbuildingDocs.bulkAdd([a, b]);
    await putIndexedChunk(chunk(a.id, 0));
    await putIndexedChunk(chunk(b.id, 0));

    await deleteWorldbuildingDoc(a.id);

    expect(
      await getIndexedChunksBySource(projectId, "worldbuilding", a.id),
    ).toHaveLength(0);
    expect(
      await getIndexedChunksBySource(projectId, "worldbuilding", b.id),
    ).toHaveLength(1);
  });

  it("keeps re-parented children's chunks (children are not cascaded)", async () => {
    const parent = makeWorldbuildingDoc({ projectId, title: "Parent" });
    const child = makeWorldbuildingDoc({
      projectId,
      title: "Child",
      parentDocId: parent.id,
    });
    await db.worldbuildingDocs.bulkAdd([parent, child]);
    await putIndexedChunk(chunk(child.id, 0));

    await deleteWorldbuildingDoc(parent.id);

    const reparented = await db.worldbuildingDocs.get(child.id);
    expect(reparented?.parentDocId).toBe(parent.parentDocId);
    expect(
      await getIndexedChunksBySource(projectId, "worldbuilding", child.id),
    ).toHaveLength(1);
  });
});

describe("deleteWorldbuildingDoc (re-parenting)", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.worldbuildingDocs.clear();
  });

  it("children adopted by deleted doc's parent", async () => {
    const grandparent = makeWorldbuildingDoc({
      projectId,
      title: "Grandparent",
    });
    const parent = makeWorldbuildingDoc({
      projectId,
      title: "Parent",
      parentDocId: grandparent.id,
    });
    const child = makeWorldbuildingDoc({
      projectId,
      title: "Child",
      parentDocId: parent.id,
    });
    await db.worldbuildingDocs.bulkAdd([grandparent, parent, child]);

    await deleteWorldbuildingDoc(parent.id);

    const updated = await getWorldbuildingDoc(child.id);
    expect(updated?.parentDocId).toBe(grandparent.id);
  });

  it("root doc deleted -> children become roots", async () => {
    const root = makeWorldbuildingDoc({ projectId, title: "Root" });
    const child = makeWorldbuildingDoc({
      projectId,
      title: "Child",
      parentDocId: root.id,
    });
    await db.worldbuildingDocs.bulkAdd([root, child]);

    await deleteWorldbuildingDoc(root.id);

    const updated = await getWorldbuildingDoc(child.id);
    expect(updated?.parentDocId).toBeNull();
  });

  it("leaf doc deletion leaves parent intact", async () => {
    const parent = makeWorldbuildingDoc({ projectId, title: "Parent" });
    const leaf = makeWorldbuildingDoc({
      projectId,
      title: "Leaf",
      parentDocId: parent.id,
    });
    await db.worldbuildingDocs.bulkAdd([parent, leaf]);

    await deleteWorldbuildingDoc(leaf.id);

    const parentDoc = await getWorldbuildingDoc(parent.id);
    expect(parentDoc).toBeDefined();
    expect(parentDoc?.title).toBe("Parent");
  });
});

describe("updateWorldbuildingDoc (cycle detection)", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.worldbuildingDocs.clear();
  });

  it("throws on direct cycle (parent moved under child)", async () => {
    const parent = makeWorldbuildingDoc({ projectId, title: "Parent" });
    const child = makeWorldbuildingDoc({
      projectId,
      title: "Child",
      parentDocId: parent.id,
    });
    await db.worldbuildingDocs.bulkAdd([parent, child]);

    await expect(
      updateWorldbuildingDoc(parent.id, { parentDocId: child.id }),
    ).rejects.toThrow("Cannot move a document under one of its own children.");
  });

  it("throws on indirect cycle (A->B->C, move A under C)", async () => {
    const a = makeWorldbuildingDoc({ projectId, title: "A" });
    const b = makeWorldbuildingDoc({
      projectId,
      title: "B",
      parentDocId: a.id,
    });
    const c = makeWorldbuildingDoc({
      projectId,
      title: "C",
      parentDocId: b.id,
    });
    await db.worldbuildingDocs.bulkAdd([a, b, c]);

    await expect(
      updateWorldbuildingDoc(a.id, { parentDocId: c.id }),
    ).rejects.toThrow("Cannot move a document under one of its own children.");
  });

  it("throws on self-reference", async () => {
    const doc = makeWorldbuildingDoc({ projectId, title: "Self" });
    await db.worldbuildingDocs.add(doc);

    await expect(
      updateWorldbuildingDoc(doc.id, { parentDocId: doc.id }),
    ).rejects.toThrow("Cannot move a document under one of its own children.");
  });

  it("allows valid reparenting", async () => {
    const a = makeWorldbuildingDoc({ projectId, title: "A" });
    const b = makeWorldbuildingDoc({ projectId, title: "B" });
    await db.worldbuildingDocs.bulkAdd([a, b]);

    await expect(
      updateWorldbuildingDoc(b.id, { parentDocId: a.id }),
    ).resolves.toBeUndefined();
  });

  it("allows moving to root (null parent)", async () => {
    const parent = makeWorldbuildingDoc({ projectId, title: "Parent" });
    const child = makeWorldbuildingDoc({
      projectId,
      title: "Child",
      parentDocId: parent.id,
    });
    await db.worldbuildingDocs.bulkAdd([parent, child]);

    await expect(
      updateWorldbuildingDoc(child.id, { parentDocId: null }),
    ).resolves.toBeUndefined();
  });
});

describe("createWorldbuildingDoc", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.worldbuildingDocs.clear();
  });

  it("assigns a fresh order after a middle sibling is deleted, not colliding with an existing one", async () => {
    const first = await createWorldbuildingDoc({ projectId, title: "A" });
    const middle = await createWorldbuildingDoc({ projectId, title: "B" });
    const last = await createWorldbuildingDoc({ projectId, title: "C" });
    expect([first.order, middle.order, last.order]).toEqual([0, 1, 2]);

    await deleteWorldbuildingDoc(middle.id);

    const fourth = await createWorldbuildingDoc({ projectId, title: "D" });

    expect(fourth.order).not.toBe(last.order);
    expect(fourth.order).toBe(3);
  });

  it("scopes order by parentDocId, not globally", async () => {
    const root1 = await createWorldbuildingDoc({ projectId, title: "Root1" });
    const root2 = await createWorldbuildingDoc({ projectId, title: "Root2" });
    const child1 = await createWorldbuildingDoc({
      projectId,
      title: "Child1",
      parentDocId: root1.id,
    });

    // root1 and root2 are both roots (parentDocId=null), auto-ordered 0,1.
    expect(root1.order).toBe(0);
    expect(root2.order).toBe(1);
    // child1 is under root1, so it starts at 0 within that scope.
    expect(child1.order).toBe(0);
  });
});
