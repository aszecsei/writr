import { describe, expect, it } from "vitest";
import { rootedTerm, sentence, term } from "../test-helpers";
import type { Echo } from "../types";
import {
  detectEchoes,
  ECHO_WINDOW_SENTENCES,
  echoProximity,
  echoSeverity,
  topContentWords,
} from "./frequency";

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
    sentence([term(`filler${i}a`), term(`filler${i}b`)]);

  it("flags a content word repeated within the window", () => {
    const sentences = [
      sentence([term("gleaming"), term("blade")]),
      filler(1),
      sentence([term("gleaming"), term("armor")]),
    ];
    const echoes = detectEchoes(sentences);
    expect(echoes).toHaveLength(1);
    expect(echoes[0].word).toBe("gleaming");
    expect(echoes[0].count).toBe(2);
    expect(echoes[0].occurrences.map((o) => o.sentenceIndex)).toEqual([0, 2]);
  });

  it("collapses inflections onto the lemma so tense variants echo", () => {
    // "I wonder ... she wonders" — different surface forms, same lemma. Keyed
    // on the surface form these would never pair; on the root they echo.
    const sentences = [
      sentence([term("wonder"), term("aloud")]),
      filler(1),
      sentence([rootedTerm("wonders", "wonder", "Verb"), term("quietly")]),
    ];
    const echoes = detectEchoes(sentences);
    expect(echoes).toHaveLength(1);
    expect(echoes[0].word).toBe("wonder");
    expect(echoes[0].count).toBe(2);
  });

  it("collapses singular and plural nouns onto the lemma", () => {
    const sentences = [
      sentence([rootedTerm("dogs", "dog", "Noun", "Plural"), term("barked")]),
      sentence([term("dog"), term("howled")]),
    ];
    const echoes = detectEchoes(sentences);
    expect(echoes).toHaveLength(1);
    expect(echoes[0].word).toBe("dog");
    expect(echoes[0].count).toBe(2);
  });

  it("exempts a name by its lemma even when an occurrence is rooted", () => {
    // A name compromise mis-roots (e.g. "Rose" → "rise") stays exempt as long
    // as the proper-noun tag pins the same lemma the membership check uses.
    const sentences = [
      sentence([rootedTerm("rose", "rise", "ProperNoun"), term("smiled")]),
      sentence([rootedTerm("rose", "rise", "Noun"), term("waved")]),
    ];
    expect(detectEchoes(sentences)).toEqual([]);
  });

  it("does not flag repeats outside the window", () => {
    const sentences = [
      sentence([term("gleaming"), term("blade")]),
      ...Array.from({ length: 6 }, (_, i) => filler(i)),
      sentence([term("gleaming"), term("armor")]),
    ];
    expect(detectEchoes(sentences)).toEqual([]);
  });

  it("excludes stopwords and proper nouns", () => {
    const sentences = [
      sentence([term("the"), term("john", "ProperNoun"), term("smiled")]),
      sentence([term("the"), term("john", "ProperNoun"), term("laughed")]),
    ];
    expect(detectEchoes(sentences)).toEqual([]);
  });

  it("exempts a name flagged as a proper noun anywhere, including plain-noun occurrences", () => {
    // compromise tags a surname as ProperNoun mid-sentence but only Noun at
    // sentence start. The two bare-noun occurrences below would otherwise echo
    // each other; the proper-noun tag on the third marks the whole name exempt.
    const sentences = [
      sentence([term("macmanus", "Noun"), term("frowned")]),
      sentence([term("macmanus", "Noun"), term("nodded")]),
      sentence([term("she"), term("trusted"), term("macmanus", "ProperNoun")]),
    ];
    expect(detectEchoes(sentences)).toEqual([]);
  });

  it("requires at least two occurrences in a group", () => {
    const sentences = [sentence([term("gleaming"), term("blade")])];
    expect(detectEchoes(sentences)).toEqual([]);
  });

  it("splits distant clusters into separate groups and keeps echoed ones", () => {
    const sentences = [
      sentence([term("crimson"), term("sky")]),
      sentence([term("crimson"), term("sea")]),
      ...Array.from({ length: 6 }, (_, i) => filler(i)),
      sentence([term("crimson"), term("cloak")]),
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
      sentence([term("gleaming"), term("blade")]),
      sentence([term("gleaming"), term("hilt")]),
      // Far enough to break the window between clusters.
      ...Array.from({ length: 6 }, (_, i) => filler(i)),
      // Cluster B: a tighter triple, denser than the pair above.
      sentence([term("gleaming"), term("sky")]),
      sentence([term("gleaming"), term("sea")]),
      sentence([term("gleaming"), term("shore")]),
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
