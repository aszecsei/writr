import { describe, expect, it } from "vitest";
import type { ChapterId, ProjectId } from "@/db/schemas";
import { analyzeSentences, type ChapterAnalysisSource } from "./analyze";
import { sentence, term } from "./test-helpers";

const SOURCE: ChapterAnalysisSource = {
  chapterId: "chapter-1" as ChapterId,
  projectId: "project-1" as ProjectId,
  updatedAt: "2026-06-10T00:00:00.000Z",
};

describe("analyzeSentences", () => {
  it("tallies counts across sentences and paragraphs", () => {
    const analysis = analyzeSentences(SOURCE, [
      sentence(
        [
          term("she", "Pronoun"),
          term("ran", "Verb", "PastTense"),
          term("home", "Noun"),
        ],
        0,
      ),
      sentence(
        [
          term("the", "Determiner"),
          term("door", "Noun"),
          term("was", "Verb", "Copula"),
          term("locked", "Verb", "PastTense"),
        ],
        1,
      ),
    ]);

    expect(analysis.counts.sentences).toBe(2);
    expect(analysis.counts.words).toBe(7);
    expect(analysis.counts.paragraphs).toBe(2);
    expect(analysis.counts.sentenceLengthBuckets.short).toBe(2);
    expect(analysis.counts.openers.pronoun).toBe(1);
    expect(analysis.counts.openers.determiner).toBe(1);
    expect(analysis.counts.passiveSentences).toBe(1);
    expect(analysis.counts.wordFrequency).toMatchObject({ she: 1, was: 1 });
    expect(analysis.sourceUpdatedAt).toBe(SOURCE.updatedAt);
  });

  it("derives percentages consistent with the counts", () => {
    const analysis = analyzeSentences(SOURCE, [
      sentence([
        term("slowly", "Adverb"),
        term("she", "Pronoun"),
        term("walked", "Verb", "PastTense"),
      ]),
    ]);

    expect(analysis.derived.avgSentenceLength).toBe(3);
    expect(analysis.derived.adverbPct).toBeCloseTo(1 / 3, 5);
    expect(analysis.derived.lyAdverbsPer1000Words).toBeCloseTo(1000 / 3, 2);
    expect(analysis.derived.openerPct.adverb).toBe(1);
  });

  it("returns an empty analysis for no sentences", () => {
    const analysis = analyzeSentences(SOURCE, []);
    expect(analysis.counts.words).toBe(0);
    expect(analysis.derived.fleschReadingEase).toBe(0);
    expect(analysis.derived.vocabulary.mtld).toBeNull();
    expect(analysis.echoes).toEqual([]);
    expect(analysis.stickySentences).toEqual([]);
    expect(analysis.sentenceWordCounts).toEqual([]);
    expect(analysis.paragraphSummaries).toEqual([]);
    expect(analysis.mtldTokenCount).toBe(0);
  });

  it("records per-sentence word counts in document order", () => {
    const analysis = analyzeSentences(SOURCE, [
      sentence([term("one")], 0),
      sentence([term("two"), term("words")], 0),
      sentence([term("now"), term("three"), term("words")], 1),
    ]);

    expect(analysis.sentenceWordCounts).toEqual([1, 2, 3]);
  });

  it("rolls up paragraph summaries in document order", () => {
    const analysis = analyzeSentences(SOURCE, [
      sentence([term("one")], 0),
      sentence([term("two"), term("words")], 0),
      sentence([term("now"), term("three"), term("words")], 2),
    ]);

    expect(analysis.paragraphSummaries).toEqual([
      { sentenceCount: 2, wordCount: 3 },
      { sentenceCount: 1, wordCount: 3 },
    ]);
    expect(analysis.counts.paragraphs).toBe(analysis.paragraphSummaries.length);
  });
});
