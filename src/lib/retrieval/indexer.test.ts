import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { getIndexedChunksBySource } from "@/db/operations/indexedChunks";
import type { Chapter, ProjectId, WorldbuildingDoc } from "@/db/schemas";
import { FakeEmbeddingProvider } from "@/test/fake-embedding-provider";
import { indexSource, reindexProject } from "./indexer";

const projectId = crypto.randomUUID() as ProjectId;
const sourceId = crypto.randomUUID();

describe("indexSource", () => {
  beforeEach(async () => {
    await db.indexedChunks.clear();
  });

  it("creates one chunk row per chunk", async () => {
    const provider = new FakeEmbeddingProvider(8);
    await indexSource({
      provider,
      projectId,
      sourceType: "worldbuilding",
      sourceId,
      text: "a short doc",
    });
    const rows = await getIndexedChunksBySource(
      projectId,
      "worldbuilding",
      sourceId,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].vector).toHaveLength(8);
    expect(rows[0].embeddingModel).toBe("fake-v1");
    const norm = Math.sqrt(rows[0].vector.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 6);
  });

  it("skips re-embedding unchanged chunks", async () => {
    const provider = new FakeEmbeddingProvider(8);
    const spy = vi.spyOn(provider, "embed");
    const args = {
      provider,
      projectId,
      sourceType: "worldbuilding" as const,
      sourceId,
      text: "stable text",
    };
    await indexSource(args);
    spy.mockClear();
    await indexSource(args);
    expect(spy).not.toHaveBeenCalled();
  });

  it("re-embeds when the text changes", async () => {
    const provider = new FakeEmbeddingProvider(8);
    await indexSource({
      provider,
      projectId,
      sourceType: "worldbuilding",
      sourceId,
      text: "first",
    });
    await indexSource({
      provider,
      projectId,
      sourceType: "worldbuilding",
      sourceId,
      text: "second",
    });
    const rows = await getIndexedChunksBySource(
      projectId,
      "worldbuilding",
      sourceId,
    );
    expect(rows[0].text).toBe("second");
  });

  it("removes trailing chunks when the source shrinks", async () => {
    const provider = new FakeEmbeddingProvider(8);
    const long = Array.from(
      { length: 5 },
      (_, i) => `para ${i} ${"word ".repeat(50)}`,
    ).join("\n\n");
    await indexSource({
      provider,
      projectId,
      sourceType: "worldbuilding",
      sourceId,
      text: long,
      maxWords: 20,
    });
    const before = await getIndexedChunksBySource(
      projectId,
      "worldbuilding",
      sourceId,
    );
    expect(before.length).toBeGreaterThan(1);
    await indexSource({
      provider,
      projectId,
      sourceType: "worldbuilding",
      sourceId,
      text: "tiny",
      maxWords: 20,
    });
    const after = await getIndexedChunksBySource(
      projectId,
      "worldbuilding",
      sourceId,
    );
    expect(after).toHaveLength(1);
  });

  it("leaves chunks unchanged on a non-success embed response", async () => {
    const provider = new FakeEmbeddingProvider(8);
    vi.spyOn(provider, "embed").mockResolvedValue({
      status: "error",
      message: "boom",
    });
    await indexSource({
      provider,
      projectId,
      sourceType: "worldbuilding",
      sourceId,
      text: "anything",
    });
    expect(
      await getIndexedChunksBySource(projectId, "worldbuilding", sourceId),
    ).toHaveLength(0);
  });

  it("preserves pre-existing rows when a re-embed fails", async () => {
    const provider = new FakeEmbeddingProvider(8);
    // First index succeeds and stores a row.
    await indexSource({
      provider,
      projectId,
      sourceType: "worldbuilding",
      sourceId,
      text: "original text",
    });
    const before = await getIndexedChunksBySource(
      projectId,
      "worldbuilding",
      sourceId,
    );
    expect(before).toHaveLength(1);
    expect(before[0].text).toBe("original text");

    // Make all subsequent embed calls fail.
    vi.spyOn(provider, "embed").mockResolvedValue({
      status: "error",
      message: "boom",
    });

    // Re-index with DIFFERENT text so the hash differs and toEmbed is non-empty.
    await indexSource({
      provider,
      projectId,
      sourceType: "worldbuilding",
      sourceId,
      text: "changed text that should not be stored",
    });

    // The stored row must still hold the original text and count.
    const after = await getIndexedChunksBySource(
      projectId,
      "worldbuilding",
      sourceId,
    );
    expect(after).toHaveLength(before.length);
    expect(after[0].text).toBe("original text");
  });
});

describe("reindexProject", () => {
  let provider: FakeEmbeddingProvider;

  beforeEach(async () => {
    await db.indexedChunks.clear();
    provider = new FakeEmbeddingProvider(8);
  });

  it("indexes both worldbuilding docs and chapters", async () => {
    const docId = crypto.randomUUID();
    const chapterId = crypto.randomUUID();
    const doc = {
      id: docId,
      title: "Lore Doc",
      content: "Some lore content",
      linkedCharacterIds: [],
      linkedLocationIds: [],
    } as unknown as WorldbuildingDoc;
    const ch = {
      id: chapterId,
      title: "Chapter One",
      content: "Chapter one text",
    } as unknown as Chapter;

    await reindexProject({
      provider,
      projectId,
      worldbuildingDocs: [doc],
      chapters: [ch],
    });

    const docChunks = await getIndexedChunksBySource(
      projectId,
      "worldbuilding",
      docId,
    );
    expect(docChunks.length).toBeGreaterThan(0);

    const chapterChunks = await getIndexedChunksBySource(
      projectId,
      "chapter",
      chapterId,
    );
    expect(chapterChunks.length).toBeGreaterThan(0);
  });

  it("skips sources in skipSourceIds", async () => {
    const skippedDocId = crypto.randomUUID();
    const skippedChapterId = crypto.randomUUID();
    const doc = {
      id: skippedDocId,
      title: "Skipped Doc",
      content: "This should not be indexed",
      linkedCharacterIds: [],
      linkedLocationIds: [],
    } as unknown as WorldbuildingDoc;
    const ch = {
      id: skippedChapterId,
      title: "Skipped Chapter",
      content: "This should not be indexed either",
    } as unknown as Chapter;

    await reindexProject({
      provider,
      projectId,
      worldbuildingDocs: [doc],
      chapters: [ch],
      skipSourceIds: new Set([skippedDocId, skippedChapterId]),
    });

    const docChunks = await getIndexedChunksBySource(
      projectId,
      "worldbuilding",
      skippedDocId,
    );
    expect(docChunks).toHaveLength(0);

    const chapterChunks = await getIndexedChunksBySource(
      projectId,
      "chapter",
      skippedChapterId,
    );
    expect(chapterChunks).toHaveLength(0);
  });

  it("bails immediately when given an already-aborted AbortSignal", async () => {
    const docId = crypto.randomUUID();
    const chapterId = crypto.randomUUID();
    const doc = {
      id: docId,
      title: "Aborted Doc",
      content: "Should never be indexed",
      linkedCharacterIds: [],
      linkedLocationIds: [],
    } as unknown as WorldbuildingDoc;
    const ch = {
      id: chapterId,
      title: "Aborted Chapter",
      content: "Should never be indexed either",
    } as unknown as Chapter;

    await reindexProject({
      provider,
      projectId,
      worldbuildingDocs: [doc],
      chapters: [ch],
      signal: AbortSignal.abort(),
    });

    const docChunks = await getIndexedChunksBySource(
      projectId,
      "worldbuilding",
      docId,
    );
    expect(docChunks).toHaveLength(0);

    const chapterChunks = await getIndexedChunksBySource(
      projectId,
      "chapter",
      chapterId,
    );
    expect(chapterChunks).toHaveLength(0);
  });
});
