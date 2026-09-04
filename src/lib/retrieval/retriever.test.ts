import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type {
  Chapter,
  Character,
  ProjectId,
  WorldbuildingDoc,
} from "@/db/schemas";
import { FakeEmbeddingProvider } from "@/test/fake-embedding-provider";
import { indexSource } from "./indexer";
import { retrieveContext } from "./retriever";
import type { RetrievalSettings } from "./types";

const projectId = crypto.randomUUID() as ProjectId;

function chapter(id: string, order: number, title: string, content: string) {
  return {
    id,
    projectId,
    order,
    title,
    content,
    parentChapterId: null,
    section: "manuscript",
    kind: "document",
  } as unknown as Chapter;
}

function settings(
  overrides: Partial<RetrievalSettings> = {},
): RetrievalSettings {
  return {
    omniscient: false,
    loreTopK: 5,
    sceneTopK: 5,
    similarityFloor: -1,
    ...overrides,
  };
}

describe("retrieveContext", () => {
  let provider: FakeEmbeddingProvider;

  beforeEach(async () => {
    await db.indexedChunks.clear();
    provider = new FakeEmbeddingProvider(16);
  });

  it("excludes the current chapter from results", async () => {
    const cur = chapter("cur", 1, "Current", "the funeral was somber");
    await indexSource({
      provider,
      projectId,
      sourceType: "chapter",
      sourceId: "cur",
      text: cur.content,
    });
    const result = await retrieveContext({
      provider,
      projectId,
      currentChapter: cur,
      chapters: [cur],
      characters: [],
      locations: [],
      worldbuildingDocs: [],
      settings: settings(),
    });
    expect(result.pastEvents.every((h) => h.sourceId !== "cur")).toBe(true);
  });

  it("never returns future scenes unless omniscient", async () => {
    const prev = chapter("c1", 1, "One", "earlier scene text");
    const cur = chapter("c2", 2, "Two", "current scene text");
    const next = chapter("c3", 3, "Three", "later scene text");
    for (const c of [prev, cur, next]) {
      await indexSource({
        provider,
        projectId,
        sourceType: "chapter",
        sourceId: c.id,
        text: c.content,
      });
    }
    const base = {
      provider,
      projectId,
      currentChapter: cur,
      chapters: [prev, cur, next],
      characters: [],
      locations: [],
      worldbuildingDocs: [],
    };
    const forward = await retrieveContext({
      ...base,
      settings: settings(),
    });
    expect(forward.futureEvents).toHaveLength(0);
    expect(forward.pastEvents.map((h) => h.sourceId)).toContain("c1");
    expect(forward.pastEvents.map((h) => h.sourceId)).not.toContain("c3");

    const omni = await retrieveContext({
      ...base,
      settings: settings({ omniscient: true }),
    });
    expect(omni.futureEvents.map((h) => h.sourceId)).toContain("c3");
    expect(omni.pastEvents.map((h) => h.sourceId)).not.toContain("c3");
  });

  it("force-includes entity-linked lore below the similarity floor", async () => {
    const cur = chapter("cur", 1, "Current", "Medibund entered the hall.");
    const medi = { id: "char1", name: "Medibund" } as unknown as Character;
    const doc = {
      id: "doc1",
      projectId,
      title: "Court intrigue",
      content: "A note about palace politics with no shared words.",
      linkedCharacterIds: ["char1"],
      linkedLocationIds: [],
    } as unknown as WorldbuildingDoc;
    await indexSource({
      provider,
      projectId,
      sourceType: "worldbuilding",
      sourceId: "doc1",
      text: `${doc.title}\n\n${doc.content}`,
    });
    const result = await retrieveContext({
      provider,
      projectId,
      currentChapter: cur,
      chapters: [cur],
      characters: [medi],
      locations: [],
      worldbuildingDocs: [doc],
      // Floor of 2 is unreachable by cosine (max 1) → only entity link can include it.
      settings: settings({ similarityFloor: 2 }),
    });
    expect(result.lore.map((h) => h.sourceId)).toContain("doc1");
  });

  it("excludes orphaned chunks whose source no longer exists", async () => {
    const cur = chapter("cur", 2, "Current", "the funeral was somber");
    // Index a past chapter and a worldbuilding doc, then drop both from the
    // live source lists to simulate sources deleted without chunk cleanup.
    await indexSource({
      provider,
      projectId,
      sourceType: "chapter",
      sourceId: "ghost-chapter",
      text: "the funeral was somber and grim",
    });
    await indexSource({
      provider,
      projectId,
      sourceType: "worldbuilding",
      sourceId: "ghost-doc",
      text: "the funeral was somber for the realm",
    });

    const result = await retrieveContext({
      provider,
      projectId,
      currentChapter: cur,
      chapters: [cur],
      characters: [],
      locations: [],
      worldbuildingDocs: [],
      settings: settings({ omniscient: true }),
    });

    expect(result.lore).toHaveLength(0);
    expect(result.pastEvents).toHaveLength(0);
    expect(result.futureEvents).toHaveLength(0);
  });

  it("respects topK limits", async () => {
    const cur = chapter("cur", 10, "Current", "query text here");
    const chapters: Chapter[] = [cur];
    for (let i = 0; i < 8; i++) {
      const c = chapter(`p${i}`, i, `P${i}`, `past scene ${i} query text here`);
      chapters.push(c);
      await indexSource({
        provider,
        projectId,
        sourceType: "chapter",
        sourceId: c.id,
        text: c.content,
      });
    }
    const result = await retrieveContext({
      provider,
      projectId,
      currentChapter: cur,
      chapters,
      characters: [],
      locations: [],
      worldbuildingDocs: [],
      settings: settings({ sceneTopK: 3 }),
    });
    expect(result.pastEvents.length).toBeLessThanOrEqual(3);
  });
});
