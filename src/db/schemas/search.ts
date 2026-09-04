import { z } from "zod/v4";
import { IndexedChunkIdSchema, ProjectIdSchema } from "./ids";
import { timestamp } from "./shared";

// ─── Indexed Chunk (vector retrieval) ───────────────────────────────

const IndexedChunkSourceTypeEnum = z.enum(["worldbuilding", "chapter"]);
export type IndexedChunkSourceType = z.infer<typeof IndexedChunkSourceTypeEnum>;

export const IndexedChunkSchema = z.object({
  id: IndexedChunkIdSchema,
  projectId: ProjectIdSchema,
  sourceType: IndexedChunkSourceTypeEnum,
  /** WorldbuildingDocId or ChapterId of the chunk's source. */
  sourceId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  text: z.string(),
  contentHash: z.string(),
  vector: z.array(z.number()),
  /** EmbeddingProvider.id used — re-embed when it changes. */
  embeddingModel: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type IndexedChunk = z.infer<typeof IndexedChunkSchema>;
