import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { makeWorldbuildingDoc, resetIdCounter } from "@/test/helpers";
import { db } from "../database";
import type { ProjectId } from "../schemas";
import { getIndexedChunksBySource, putIndexedChunk } from "./indexedChunks";
import {
  createWorldbuildingDoc,
  deleteWorldbuildingDoc,
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
});
