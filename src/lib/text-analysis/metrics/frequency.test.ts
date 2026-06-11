import { describe, expect, it } from "vitest";
import type { AnalyzedSentence, AnalyzedTerm, Echo } from "../types";
import {
  detectEchoes,
  ECHO_WINDOW_SENTENCES,
  echoProximity,
  echoSeverity,
  topContentWords,
} from "./frequency";

function term(normal: string, ...tags: string[]): AnalyzedTerm {
  return { normal, tags: new Set(tags), syllables: 1 };
}

function sentenceOf(
  terms: AnalyzedTerm[],
  paragraphIndex = 0,
): AnalyzedSentence {
  return {
    text: terms.map((t) => t.normal).join(" "),
    terms,
    paragraphIndex,
  };
}

describe("topContentWords", () => {
  it("excludes stopwords, numbers and short words", () => {
    const top = topContentWords({
      the: 50,
      and: 30,
      dragon: 5,
      of: 20,
      "42": 9,
      ox: 9,
      sword: 3,
    });
    expect(top).toEqual([
      { word: "dragon", count: 5 },
      { word: "sword", count: 3 },
    ]);
  });

  it("orders by count then alphabetically, capped at the limit", () => {
    const top = topContentWords({ zebra: 2, apple: 2, mango: 3 }, 2);
    expect(top).toEqual([
      { word: "mango", count: 3 },
      { word: "apple", count: 2 },
    ]);
  });
});

describe("detectEchoes", () => {
  const filler = (i: number) =>
    sentenceOf([term(`filler${i}a`), term(`filler${i}b`)]);

  it("flags a content word repeated within the window", () => {
    const sentences = [
      sentenceOf([term("gleaming"), term("blade")]),
      filler(1),
      sentenceOf([term("gleaming"), term("armor")]),
    ];
    const echoes = detectEchoes(sentences);
    expect(echoes).toHaveLength(1);
    expect(echoes[0].word).toBe("gleaming");
    expect(echoes[0].count).toBe(2);
    expect(echoes[0].occurrences.map((o) => o.sentenceIndex)).toEqual([0, 2]);
  });

  it("does not flag repeats outside the window", () => {
    const sentences = [
      sentenceOf([term("gleaming"), term("blade")]),
      ...Array.from({ length: 6 }, (_, i) => filler(i)),
      sentenceOf([term("gleaming"), term("armor")]),
    ];
    expect(detectEchoes(sentences)).toEqual([]);
  });

  it("excludes stopwords and proper nouns", () => {
    const sentences = [
      sentenceOf([term("the"), term("john", "ProperNoun"), term("smiled")]),
      sentenceOf([term("the"), term("john", "ProperNoun"), term("laughed")]),
    ];
    expect(detectEchoes(sentences)).toEqual([]);
  });

  it("exempts a name flagged as a proper noun anywhere, including plain-noun occurrences", () => {
    // compromise tags a surname as ProperNoun mid-sentence but only Noun at
    // sentence start. The two bare-noun occurrences below would otherwise echo
    // each other; the proper-noun tag on the third marks the whole name exempt.
    const sentences = [
      sentenceOf([term("macmanus", "Noun"), term("frowned")]),
      sentenceOf([term("macmanus", "Noun"), term("nodded")]),
      sentenceOf([
        term("she"),
        term("trusted"),
        term("macmanus", "ProperNoun"),
      ]),
    ];
    expect(detectEchoes(sentences)).toEqual([]);
  });

  it("requires at least two occurrences in a group", () => {
    const sentences = [sentenceOf([term("gleaming"), term("blade")])];
    expect(detectEchoes(sentences)).toEqual([]);
  });

  it("splits distant clusters into separate groups and keeps echoed ones", () => {
    const sentences = [
      sentenceOf([term("crimson"), term("sky")]),
      sentenceOf([term("crimson"), term("sea")]),
      ...Array.from({ length: 6 }, (_, i) => filler(i)),
      sentenceOf([term("crimson"), term("cloak")]),
    ];
    const echoes = detectEchoes(sentences);
    // The first two echo each other; the distant third stands alone and is
    // excluded from the occurrence list.
    expect(echoes).toHaveLength(1);
    expect(echoes[0].occurrences.map((o) => o.sentenceIndex)).toEqual([0, 1]);
  });

  it("reports only the densest cluster when a word echoes in several places", () => {
    const sentences = [
      // Cluster A: a loose pair.
      sentenceOf([term("gleaming"), term("blade")]),
      sentenceOf([term("gleaming"), term("hilt")]),
      // Far enough to break the window between clusters.
      ...Array.from({ length: 6 }, (_, i) => filler(i)),
      // Cluster B: a tighter triple, denser than the pair above.
      sentenceOf([term("gleaming"), term("sky")]),
      sentenceOf([term("gleaming"), term("sea")]),
      sentenceOf([term("gleaming"), term("shore")]),
    ];
    const echoes = detectEchoes(sentences);
    // One row for the word, representing its densest cluster — not a merged
    // count spanning both clusters.
    expect(echoes).toHaveLength(1);
    expect(echoes[0].word).toBe("gleaming");
    expect(echoes[0].count).toBe(3);
    expect(echoes[0].occurrences.map((o) => o.sentenceIndex)).toEqual([
      8, 9, 10,
    ]);
    // Proximity stays within the detection window; no cross-cluster gap.
    expect(echoProximity(echoes[0]).maxGap).toBeLessThanOrEqual(
      ECHO_WINDOW_SENTENCES,
    );
  });
});

function echoAt(sentenceIndexes: number[]): Echo {
  return {
    word: "gleaming",
    count: sentenceIndexes.length,
    occurrences: sentenceIndexes.map((sentenceIndex) => ({
      sentenceIndex,
      excerpt: "…",
    })),
  };
}

describe("echoProximity", () => {
  it("reports min and max gaps between consecutive occurrences", () => {
    expect(echoProximity(echoAt([0, 1, 4]))).toEqual({ minGap: 1, maxGap: 3 });
  });

  it("reports a zero gap for same-sentence occurrences", () => {
    expect(echoProximity(echoAt([2, 2]))).toEqual({ minGap: 0, maxGap: 0 });
  });

  it("collapses to a single gap for two occurrences", () => {
    expect(echoProximity(echoAt([3, 8]))).toEqual({ minGap: 5, maxGap: 5 });
  });

  it("throws on fewer than two occurrences", () => {
    expect(() => echoProximity(echoAt([1]))).toThrow(/at least 2/);
  });
});

describe("echoSeverity", () => {
  it("marks four or more occurrences dense regardless of spacing", () => {
    expect(echoSeverity(echoAt([0, 5, 10, 15]))).toBe("dense");
  });

  it("marks three tightly-packed occurrences dense", () => {
    expect(echoSeverity(echoAt([0, 1, 4]))).toBe("dense");
  });

  it("keeps three spread-out occurrences an ordinary echo", () => {
    expect(echoSeverity(echoAt([0, 2, 4]))).toBe("echo");
  });

  it("keeps two occurrences an ordinary echo even when adjacent", () => {
    expect(echoSeverity(echoAt([0, 1]))).toBe("echo");
  });
});
