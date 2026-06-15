import { getIndexedChunksByProject } from "@/db/operations/indexedChunks";
import type {
  Chapter,
  ChapterId,
  Character,
  IndexedChunk,
  Location,
  ProjectId,
  WorldbuildingDoc,
} from "@/db/schemas";
import { manuscriptIndexMap } from "@/lib/binder/tree";
import { chunkText } from "./chunker";
import { cosineSimilarity } from "./cosine";
import type { EmbeddingProvider } from "./embedding/provider";
import { findMentionedEntityIds } from "./entities";
import type { RetrievalHit, RetrievalResult, RetrievalSettings } from "./types";

const ENTITY_LINK_SCORE = Number.POSITIVE_INFINITY;

export interface RetrieveContextArgs {
  provider: EmbeddingProvider;
  projectId: ProjectId;
  currentChapter: Chapter;
  chapters: readonly Chapter[];
  characters: readonly Character[];
  locations: readonly Location[];
  worldbuildingDocs: readonly WorldbuildingDoc[];
  settings: RetrievalSettings;
}

/** Best cosine of a stored chunk against any of the query vectors. */
function bestScore(chunk: IndexedChunk, queryVectors: number[][]): number {
  let best = -Infinity;
  for (const q of queryVectors)
    best = Math.max(best, cosineSimilarity(q, chunk.vector));
  return best;
}

function topK(hits: RetrievalHit[], k: number): RetrievalHit[] {
  return [...hits]
    .sort((a, b) => (a.score === b.score ? 0 : a.score > b.score ? -1 : 1))
    .slice(0, k);
}

export async function retrieveContext(
  args: RetrieveContextArgs,
): Promise<RetrievalResult> {
  const { provider, projectId, currentChapter, settings } = args;
  const empty: RetrievalResult = { lore: [], pastEvents: [], futureEvents: [] };

  const queryChunks = chunkText(currentChapter.content);
  if (queryChunks.length === 0) return empty;

  const res = await provider.embed(queryChunks);
  if (res.status !== "success" || !res.output) return empty;
  const queryVectors = res.output;

  const all = await getIndexedChunksByProject(projectId);
  if (all.length === 0) return empty;

  const titleFor = new Map<string, string>();
  for (const d of args.worldbuildingDocs) titleFor.set(d.id, d.title);
  for (const c of args.chapters) titleFor.set(c.id, c.title);

  // Entity-link signal: worldbuilding docs linked to entities named in the chapter.
  const mentioned = findMentionedEntityIds(
    currentChapter.content,
    args.characters,
    args.locations,
  );
  const linkedDocIds = new Set<string>();
  for (const d of args.worldbuildingDocs) {
    const linked =
      d.linkedCharacterIds.some((id) => mentioned.characterIds.has(id)) ||
      d.linkedLocationIds.some((id) => mentioned.locationIds.has(id));
    if (linked) linkedDocIds.add(d.id);
  }

  const indexOf = manuscriptIndexMap([...args.chapters]);
  const currentIndex = indexOf.get(currentChapter.id) ?? -1;

  const lore: RetrievalHit[] = [];
  const past: RetrievalHit[] = [];
  const future: RetrievalHit[] = [];

  for (const chunk of all) {
    const semantic = bestScore(chunk, queryVectors);
    const hit = (score: number): RetrievalHit => ({
      sourceId: chunk.sourceId,
      chunkIndex: chunk.chunkIndex,
      title: titleFor.get(chunk.sourceId) ?? "Untitled",
      text: chunk.text,
      score,
    });

    if (chunk.sourceType === "worldbuilding") {
      const linked = linkedDocIds.has(chunk.sourceId);
      if (linked) lore.push(hit(ENTITY_LINK_SCORE));
      else if (semantic >= settings.similarityFloor) lore.push(hit(semantic));
      continue;
    }

    // chapter scene
    if (chunk.sourceId === currentChapter.id) continue; // never the query chapter
    if (semantic < settings.similarityFloor) continue;
    const idx = indexOf.get(chunk.sourceId as ChapterId);
    if (idx === undefined || currentIndex < 0) continue;
    if (idx < currentIndex) past.push(hit(semantic));
    else if (idx > currentIndex) future.push(hit(semantic));
  }

  return {
    lore: topK(lore, settings.loreTopK),
    pastEvents: topK(past, settings.sceneTopK),
    futureEvents: settings.omniscient ? topK(future, settings.sceneTopK) : [],
  };
}
