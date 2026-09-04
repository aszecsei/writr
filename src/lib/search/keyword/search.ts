import type MiniSearch from "minisearch";
import type { SearchResult as MiniSearchResult } from "minisearch";
import type { ChapterId } from "@/db/schemas";
import { entityConfigs, entityTypeOrder } from "../entity-config";
import { extractSnippet } from "../highlight";
import type {
  GroupedSearchResults,
  PaginatedSearchResults,
  SearchableEntityType,
  SearchResult,
} from "../types";
import {
  type BuiltIndex,
  type BuiltParagraphIndex,
  buildChapterParagraphIndex,
  buildChaptersIndex,
  buildProjectIndex,
} from "./build-index";
import type { IndexedDoc } from "./document";
import { parseQuery } from "./parse-query";

/**
 * Pipeline shared by entity and paragraph search: parseQuery → BM25
 * candidates (or all docs if pure phrase) → post-filter by quoted phrases →
 * sort by score with a caller-supplied tie-break. Returns the parsed phrases
 * alongside the scored results so callers don't need to re-parse the query.
 */
function runScoredQuery<TDoc, TScored extends { score: number }>(
  built: { index: MiniSearch; docs: Map<string, TDoc> },
  raw: string,
  hooks: {
    toScored: (doc: TDoc, row: MiniSearchResult) => TScored;
    zeroScored: (doc: TDoc) => TScored;
    matchesPhrase: (scored: TScored, phrase: string) => boolean;
    compareTie: (a: TScored, b: TScored) => number;
  },
): { scored: TScored[]; phrases: string[] } {
  const { phrases, tokens } = parseQuery(raw);

  let scored: TScored[];
  if (tokens) {
    scored = built.index.search(tokens).flatMap((row) => {
      const doc = built.docs.get(row.id);
      return doc ? [hooks.toScored(doc, row)] : [];
    });
  } else {
    // Pure quoted-phrase query: minisearch has nothing to score on, so every
    // doc is a candidate and ranking falls to the post-filter.
    scored = Array.from(built.docs.values()).map(hooks.zeroScored);
  }

  if (phrases.length) {
    scored = scored.filter((s) =>
      phrases.every((phrase) => hooks.matchesPhrase(s, phrase)),
    );
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return hooks.compareTie(a, b);
  });

  return { scored, phrases };
}

/**
 * Find the best (highest-priority) field name to attribute the match to. We
 * iterate the entity's searchableFields in declaration order and return the
 * first field that minisearch reported as containing any matched term.
 */
function pickMatchField(
  entityType: SearchableEntityType,
  match: Record<string, string[]>,
): string {
  const matchedFields = new Set<string>();
  for (const fields of Object.values(match)) {
    for (const f of fields) matchedFields.add(f);
  }
  const order = entityConfigs[entityType].searchableFields;
  for (const field of order) {
    if (matchedFields.has(field)) return field;
  }
  // Fallback: a phrase-only query has no minisearch match; report the highest-
  // priority field that contains text.
  return order[0] ?? "title";
}

function buildSnippet(
  doc: IndexedDoc,
  matchField: string,
  phrases: string[],
  matchedTerms: string[],
): string {
  const text = doc.fields[matchField] ?? doc.displayTitle ?? "";
  // Prefer anchoring the snippet on a literal phrase if one exists in the
  // text — that's where the user's eye expects the highlight.
  for (const phrase of phrases) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      return extractSnippet(text, phrase);
    }
  }
  // Otherwise anchor on the first BM25-matched term.
  for (const term of matchedTerms) {
    if (term && text.toLowerCase().includes(term.toLowerCase())) {
      return extractSnippet(text, term);
    }
  }
  return extractSnippet(text, matchedTerms[0] ?? "");
}

function docMatchesPhrase(doc: IndexedDoc, phrase: string): boolean {
  const needle = phrase.toLowerCase();
  const haystacks = [
    doc.displayTitle.toLowerCase(),
    ...Object.values(doc.fields).map((v) => v.toLowerCase()),
  ];
  return haystacks.some((h) => h.includes(needle));
}

interface ScoredDoc {
  doc: IndexedDoc;
  score: number;
  match: Record<string, string[]>;
  terms: string[];
}

function runQuery(
  built: BuiltIndex,
  raw: string,
): { scored: ScoredDoc[]; phrases: string[] } {
  return runScoredQuery(built, raw, {
    toScored: (doc, row) => ({
      doc,
      score: row.score,
      match: row.match,
      terms: row.terms,
    }),
    zeroScored: (doc) => ({ doc, score: 0, match: {}, terms: [] }),
    matchesPhrase: (s, phrase) => docMatchesPhrase(s.doc, phrase),
    compareTie: (a, b) =>
      entityTypeOrder.indexOf(a.doc.entityType) -
      entityTypeOrder.indexOf(b.doc.entityType),
  });
}

function toSearchResult(scored: ScoredDoc, phrases: string[]): SearchResult {
  const { doc } = scored;
  const matchField = pickMatchField(doc.entityType, scored.match);
  return {
    id: doc.entityId,
    entityType: doc.entityType,
    title: doc.displayTitle,
    subtitle: doc.subtitle,
    snippet: buildSnippet(doc, matchField, phrases, scored.terms),
    matchField,
    url: doc.url,
  };
}

export async function searchProjectKeywordPaginated(
  projectId: string,
  query: string,
  page = 1,
  pageSize = 20,
  entityTypeFilter?: SearchableEntityType[],
): Promise<PaginatedSearchResults> {
  if (!query.trim()) {
    return { results: [], totalCount: 0, page, pageSize, totalPages: 0 };
  }
  const built = await buildProjectIndex(projectId, entityTypeFilter);
  const { scored, phrases } = runQuery(built, query);
  const results = scored.map((s) => toSearchResult(s, phrases));

  const totalCount = results.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize;
  return {
    results: results.slice(startIndex, startIndex + pageSize),
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

export async function searchProjectKeywordGrouped(
  projectId: string,
  query: string,
  maxPerCategory = 5,
): Promise<GroupedSearchResults[]> {
  if (!query.trim()) return [];

  const built = await buildProjectIndex(projectId);
  const { scored, phrases } = runQuery(built, query);

  // Bucket scored docs by entity type, preserving relevance order within each
  // bucket. Then emit groups in entityTypeOrder so the UI's grouping order
  // stays stable across queries.
  const buckets = new Map<SearchableEntityType, ScoredDoc[]>();
  for (const s of scored) {
    const list = buckets.get(s.doc.entityType) ?? [];
    list.push(s);
    buckets.set(s.doc.entityType, list);
  }

  const out: GroupedSearchResults[] = [];
  for (const entityType of entityTypeOrder) {
    const list = buckets.get(entityType);
    if (!list || list.length === 0) continue;
    const config = entityConfigs[entityType];
    out.push({
      entityType,
      label: config.label,
      labelPlural: config.labelPlural,
      icon: config.icon,
      results: list
        .slice(0, maxPerCategory)
        .map((s) => toSearchResult(s, phrases)),
    });
  }
  return out;
}

export interface ChapterKeywordMatch {
  id: string;
  title: string;
  snippet: string;
}

export async function searchChaptersKeyword(
  projectId: string,
  query: string,
  opts: { readableChapterIds?: ReadonlySet<string> } = {},
): Promise<ChapterKeywordMatch[]> {
  if (!query.trim()) return [];
  const built = await buildChaptersIndex(projectId, opts.readableChapterIds);
  const { scored, phrases } = runQuery(built, query);
  return scored.map((s) => {
    const matchField = pickMatchField(s.doc.entityType, s.match);
    return {
      id: s.doc.entityId,
      title: s.doc.displayTitle,
      snippet: buildSnippet(s.doc, matchField, phrases, s.terms),
    };
  });
}

export interface ParagraphKeywordMatch {
  paragraph: number;
  snippet: string;
}

interface ParagraphScored {
  paragraphNumber: number;
  text: string;
  score: number;
  terms: string[];
}

function runParagraphQuery(
  built: BuiltParagraphIndex,
  raw: string,
): ParagraphScored[] {
  const { scored } = runScoredQuery(built, raw, {
    toScored: (doc, row) => ({
      paragraphNumber: doc.paragraphNumber,
      text: doc.text,
      score: row.score,
      terms: row.terms,
    }),
    zeroScored: (doc) => ({
      paragraphNumber: doc.paragraphNumber,
      text: doc.text,
      score: 0,
      terms: [],
    }),
    matchesPhrase: (s, phrase) =>
      s.text.toLowerCase().includes(phrase.toLowerCase()),
    compareTie: (a, b) => a.paragraphNumber - b.paragraphNumber,
  });
  return scored;
}

export async function searchChapterParagraphsKeyword(
  chapterId: ChapterId,
  query: string,
  opts: { contextParagraphs?: number; maxResults?: number } = {},
): Promise<{
  chapter: { id: string; title: string } | null;
  matches: ParagraphKeywordMatch[];
}> {
  const { chapter, built } = await buildChapterParagraphIndex(chapterId);
  if (!chapter || !built) return { chapter: null, matches: [] };
  if (!query.trim()) return { chapter, matches: [] };

  const scored = runParagraphQuery(built, query);
  const ctxSize = opts.contextParagraphs ?? 1;
  const max = opts.maxResults ?? 10;

  // Reconstruct the full paragraph list for context windows. The built index
  // already iterated splitParagraphs once; do it again rather than threading
  // the array through (simpler, and chapter.content access is cheap).
  const paragraphs = Array.from(built.docs.values())
    .sort((a, b) => a.paragraphNumber - b.paragraphNumber)
    .map((d) => d.text);

  const matches: ParagraphKeywordMatch[] = [];
  for (const s of scored) {
    if (matches.length >= max) break;
    const idx = s.paragraphNumber - 1;
    const from = Math.max(0, idx - ctxSize);
    const to = Math.min(paragraphs.length - 1, idx + ctxSize);
    const snippet = paragraphs.slice(from, to + 1).join("\n\n");
    matches.push({ paragraph: s.paragraphNumber, snippet });
  }

  return { chapter: { id: chapter.id, title: chapter.title }, matches };
}
