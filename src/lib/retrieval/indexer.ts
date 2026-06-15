import {
  deleteIndexedChunk,
  getIndexedChunksBySource,
  putIndexedChunk,
} from "@/db/operations/indexedChunks";
import type {
  Chapter,
  IndexedChunkSourceType,
  ProjectId,
  WorldbuildingDoc,
} from "@/db/schemas";
import { chunkText } from "./chunker";
import type { EmbeddingProvider } from "./embedding/provider";
import { hashText } from "./hash";

export interface IndexSourceArgs {
  provider: EmbeddingProvider;
  projectId: ProjectId;
  sourceType: IndexedChunkSourceType;
  sourceId: string;
  text: string;
  maxWords?: number;
  overlapWords?: number;
  signal?: AbortSignal;
}

/**
 * Index one source (a worldbuilding doc or chapter). Chunks the text, embeds
 * only chunks whose contentHash or embeddingModel changed, upserts them, and
 * deletes chunk rows beyond the new chunk count. On a non-success embed
 * response the store is left untouched (chunks stay stale, retried later).
 */
export async function indexSource(args: IndexSourceArgs): Promise<void> {
  const { provider, projectId, sourceType, sourceId } = args;
  const chunks = chunkText(args.text, {
    maxWords: args.maxWords,
    overlapWords: args.overlapWords,
  });

  const existing = await getIndexedChunksBySource(
    projectId,
    sourceType,
    sourceId,
  );
  const existingByIndex = new Map(existing.map((c) => [c.chunkIndex, c]));

  const hashes = chunks.map(hashText);
  const toEmbed: number[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const prev = existingByIndex.get(i);
    if (
      !prev ||
      prev.contentHash !== hashes[i] ||
      prev.embeddingModel !== provider.id
    ) {
      toEmbed.push(i);
    }
  }

  if (toEmbed.length > 0) {
    const res = await provider.embed(
      toEmbed.map((i) => chunks[i]),
      { signal: args.signal },
    );
    if (res.status !== "success" || !res.output) return; // leave stale
    for (let k = 0; k < toEmbed.length; k++) {
      const i = toEmbed[k];
      await putIndexedChunk({
        projectId,
        sourceType,
        sourceId,
        chunkIndex: i,
        text: chunks[i],
        contentHash: hashes[i],
        vector: res.output[k],
        embeddingModel: provider.id,
      });
    }
  }

  // Delete chunk rows beyond the new length.
  for (const c of existing) {
    if (c.chunkIndex >= chunks.length) await deleteIndexedChunk(c.id);
  }
}

export interface ReindexProjectArgs {
  provider: EmbeddingProvider;
  projectId: ProjectId;
  worldbuildingDocs: readonly WorldbuildingDoc[];
  chapters: readonly Chapter[];
  /** Sources to skip (e.g. the active chapter, which is the query). */
  skipSourceIds?: ReadonlySet<string>;
  signal?: AbortSignal;
}

/** Bring the whole project's index up to date. Cheap after the first run
 * because unchanged chunks are skipped by hash. */
export async function reindexProject(args: ReindexProjectArgs): Promise<void> {
  const skip = args.skipSourceIds ?? new Set<string>();
  for (const doc of args.worldbuildingDocs) {
    if (args.signal?.aborted) return;
    if (skip.has(doc.id)) continue;
    await indexSource({
      provider: args.provider,
      projectId: args.projectId,
      sourceType: "worldbuilding",
      sourceId: doc.id,
      text: `${doc.title}\n\n${doc.content}`,
      signal: args.signal,
    });
  }
  for (const ch of args.chapters) {
    if (args.signal?.aborted) return;
    if (skip.has(ch.id)) continue;
    await indexSource({
      provider: args.provider,
      projectId: args.projectId,
      sourceType: "chapter",
      sourceId: ch.id,
      text: `${ch.title}\n\n${ch.content}`,
      signal: args.signal,
    });
  }
}
