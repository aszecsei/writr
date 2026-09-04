import { beforeEach, describe, expect, it } from "vitest";
import { makeProject, resetIdCounter } from "@/test/helpers";
import { db } from "../database";
import type { ProjectId } from "../schemas";
import { getIndexedChunksByProject, putIndexedChunk } from "./indexedChunks";
import { deleteProject } from "./projects";

function chunk(projectId: ProjectId, sourceId: string) {
  return {
    projectId,
    sourceType: "worldbuilding" as const,
    sourceId,
    chunkIndex: 0,
    text: "t0",
    contentHash: "h0",
    vector: [0.1, 0.2],
    embeddingModel: "fake-v1",
  };
}

describe("deleteProject", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.projects.clear();
    await db.indexedChunks.clear();
  });

  it("prunes the deleted project's indexed chunks but leaves other projects'", async () => {
    const target = makeProject({ title: "Target" });
    const other = makeProject({ title: "Other" });
    await db.projects.bulkAdd([target, other]);
    await putIndexedChunk(chunk(target.id, "doc-a"));
    await putIndexedChunk(chunk(other.id, "doc-b"));

    await deleteProject(target.id);

    expect(await getIndexedChunksByProject(target.id)).toHaveLength(0);
    expect(await getIndexedChunksByProject(other.id)).toHaveLength(1);
  });
});
