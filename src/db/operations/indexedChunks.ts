import { db } from "../database";
import {
  type IndexedChunk,
  type IndexedChunkId,
  IndexedChunkSchema,
  type IndexedChunkSourceType,
  type ProjectId,
} from "../schemas";
import { createCrud, generateId, now } from "./helpers";

export type IndexedChunkInput = Omit<
  IndexedChunk,
  "id" | "createdAt" | "updatedAt"
>;

export async function getIndexedChunksByProject(
  projectId: ProjectId,
): Promise<IndexedChunk[]> {
  return db.indexedChunks.where({ projectId }).toArray();
}

export async function getIndexedChunksBySource(
  projectId: ProjectId,
  sourceType: IndexedChunkSourceType,
  sourceId: string,
): Promise<IndexedChunk[]> {
  const rows = await db.indexedChunks
    .where({ sourceId })
    .filter((r) => r.projectId === projectId && r.sourceType === sourceType)
    .toArray();
  return rows.sort((a, b) => a.chunkIndex - b.chunkIndex);
}

/**
 * Upsert a chunk keyed on (projectId, sourceType, sourceId, chunkIndex). Reuses
 * the existing row id when one is present so re-indexing is idempotent.
 */
export async function putIndexedChunk(
  input: IndexedChunkInput,
): Promise<IndexedChunk> {
  const existing = (
    await getIndexedChunksBySource(
      input.projectId,
      input.sourceType,
      input.sourceId,
    )
  ).find((r) => r.chunkIndex === input.chunkIndex);
  const timestamp = now();
  const row = IndexedChunkSchema.parse({
    ...input,
    id: existing?.id ?? generateId(),
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  });
  await db.indexedChunks.put(row);
  return row;
}

export const deleteIndexedChunk = createCrud<IndexedChunk, IndexedChunkId>(
  db.indexedChunks,
).delete;
