import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../database";
import type { ProjectId } from "../schemas";
import {
  deleteIndexedChunksBySource,
  getIndexedChunksByProject,
  getIndexedChunksBySource,
  putIndexedChunk,
} from "./indexedChunks";

const projectId = crypto.randomUUID() as ProjectId;

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

describe("indexedChunks operations", () => {
  beforeEach(async () => {
    await db.indexedChunks.clear();
  });

  it("adds and reads chunks by source", async () => {
    await putIndexedChunk(chunk("doc1", 0));
    await putIndexedChunk(chunk("doc1", 1));
    const rows = await getIndexedChunksBySource(
      projectId,
      "worldbuilding",
      "doc1",
    );
    expect(rows.map((r) => r.chunkIndex)).toEqual([0, 1]);
  });

  it("reads all chunks for a project", async () => {
    await putIndexedChunk(chunk("doc1", 0));
    await putIndexedChunk(chunk("doc2", 0));
    expect(await getIndexedChunksByProject(projectId)).toHaveLength(2);
  });

  it("reuses the id and preserves createdAt when an existing source+index is re-put", async () => {
    const first = await putIndexedChunk(chunk("doc1", 0));
    const second = await putIndexedChunk({
      ...chunk("doc1", 0),
      text: "updated",
    });
    expect(second.id).toBe(first.id);
    // The indexer relies on createdAt surviving re-indexing (idempotency contract).
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.text).toBe("updated");
    expect(
      await getIndexedChunksBySource(projectId, "worldbuilding", "doc1"),
    ).toHaveLength(1);
  });

  it("deletes all chunks for a source", async () => {
    await putIndexedChunk(chunk("doc1", 0));
    await deleteIndexedChunksBySource(projectId, "worldbuilding", "doc1");
    expect(
      await getIndexedChunksBySource(projectId, "worldbuilding", "doc1"),
    ).toHaveLength(0);
  });
});
