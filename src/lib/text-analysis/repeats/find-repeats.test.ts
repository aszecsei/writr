import { describe, expect, it } from "vitest";
import type { ChapterId } from "@/db/schemas";
import {
  REPEAT_MIN_MATCHED_TOKENS,
  REPEAT_MIN_SELF_DISTANCE_TOKENS,
} from "../thresholds";
import { GLUE_WORDS } from "../word-lists";
import { findRepeatedPassages } from "./find-repeats";
import { repeatWeight } from "./score";
import { tokenizeChapter, tokenizeText } from "./tokenize";

const PASSAGE =
  "The salt-stained windows of the lighthouse rattled whenever the northern gale came howling across the bay.";
const PASSAGE_WORDS = tokenizeText(PASSAGE).length;

/** Unique, non-repeating content words, distinct per seed. */
function filler(seed: string, words: number): string {
  return Array.from({ length: words }, (_, i) => `${seed}w${i}`).join(" ");
}

function chapter(id: string, ...paragraphs: string[]) {
  return tokenizeChapter(id as ChapterId, paragraphs);
}

function run(...chapters: ReturnType<typeof chapter>[]) {
  const report = findRepeatedPassages(chapters);
  if (!report) throw new Error("unexpectedly cancelled");
  return report;
}

describe("findRepeatedPassages", () => {
  it("groups a passage copied into another chapter; only the later copy is redundant", () => {
    const report = run(
      chapter("c1", filler("a", 30), PASSAGE, filler("b", 30)),
      chapter("c2", filler("c", 30), PASSAGE, filler("d", 30)),
    );
    expect(report.clusters).toHaveLength(1);
    const [cluster] = report.clusters;
    expect(cluster.members.map((m) => m.chapterId)).toEqual(["c1", "c2"]);
    expect(cluster.members.map((m) => m.redundantWords)).toEqual([
      0,
      PASSAGE_WORDS,
    ]);
    expect(cluster.members[1].text).toBe(PASSAGE.replace(/\.$/, ""));
    expect(report.totalRedundantWords).toBe(PASSAGE_WORDS);
  });

  it("matches a lightly edited copy, counting only the shared words", () => {
    const edited =
      "The salt-stained windows of the lighthouse shook whenever the wild northern gale came howling across the bay.";
    const report = run(chapter("c1", PASSAGE), chapter("c2", edited));
    expect(report.clusters).toHaveLength(1);
    const redundant = report.clusters[0].members[1].redundantWords;
    expect(redundant).toBeGreaterThanOrEqual(REPEAT_MIN_MATCHED_TOKENS);
    expect(redundant).toBeLessThan(PASSAGE_WORDS);
  });

  it("ignores shared phrases shorter than the minimum match", () => {
    const phrase = "crimson lanterns swayed above the harbor";
    expect(tokenizeText(phrase).length).toBeLessThan(REPEAT_MIN_MATCHED_TOKENS);
    const report = run(
      chapter("c1", filler("a", 20), phrase, filler("b", 20)),
      chapter("c2", filler("c", 20), phrase, filler("d", 20)),
    );
    expect(report.clusters).toEqual([]);
  });

  it("ignores repeats made only of glue words", () => {
    const glue = "and then he said that it was so and then he said that it was";
    expect(tokenizeText(glue).every((t) => GLUE_WORDS.has(t.word))).toBe(true);
    const report = run(chapter("c1", glue), chapter("c2", glue));
    expect(report.clusters).toEqual([]);
  });

  it("reports a repeat far apart within one chapter, with the second copy's occurrence index", () => {
    const report = run(
      chapter(
        "c1",
        PASSAGE,
        filler("a", REPEAT_MIN_SELF_DISTANCE_TOKENS + 10),
        PASSAGE,
      ),
    );
    expect(report.clusters).toHaveLength(1);
    expect(report.clusters[0].members.map((m) => m.anchor.occurrence)).toEqual([
      0, 1,
    ]);
  });

  it("ignores close repetition within one chapter", () => {
    const report = run(chapter("c1", PASSAGE, filler("a", 10), PASSAGE));
    expect(report.clusters).toEqual([]);
  });

  it("scores each later copy, superlinearly in its length", () => {
    const report = run(
      chapter("c1", PASSAGE),
      chapter("c2", PASSAGE),
      chapter("c3", PASSAGE),
    );
    expect(report.clusters[0].score).toBeCloseTo(
      2 * repeatWeight(PASSAGE_WORDS),
    );
  });

  it("orders members by the given reading order, not by id", () => {
    const report = run(
      chapter("zz", PASSAGE),
      chapter("aa", PASSAGE),
      chapter("mm", PASSAGE),
    );
    expect(report.clusters[0].members.map((m) => m.chapterId)).toEqual([
      "zz",
      "aa",
      "mm",
    ]);
  });

  it("compares each later copy against its closest earlier copy", () => {
    const edited = PASSAGE.replace("rattled", "shook");
    const report = run(
      chapter("c1", PASSAGE),
      chapter("c2", edited),
      chapter("c3", PASSAGE),
    );
    const [, second, third] = report.clusters[0].members;
    expect(second.bestEarlier).toBe(0);
    expect(third.bestEarlier).toBe(0);
    expect(third.redundantWords).toBe(PASSAGE_WORDS);
    expect(second.redundantWords).toBeLessThan(PASSAGE_WORDS);
  });

  it("joins a refrain repeated hundreds of times into one cluster", () => {
    const chapters = Array.from({ length: 200 }, (_, i) =>
      chapter(`c${i}`, filler(`x${i}`, 10), PASSAGE, filler(`y${i}`, 10)),
    );
    const report = run(...chapters);
    expect(report.clusters).toHaveLength(1);
    expect(report.clusters[0].members).toHaveLength(200);
  });

  it("matches a passage split across paragraphs against an unbroken copy", () => {
    const [first, second] = PASSAGE.split(" whenever ");
    const report = run(
      chapter("c1", first, `whenever ${second}`),
      chapter("c2", PASSAGE),
    );
    expect(report.clusters).toHaveLength(1);
    expect(report.clusters[0].members[0].text).toContain("\n");
    expect(report.clusters[0].members[1].redundantWords).toBe(PASSAGE_WORDS);
  });

  it("ranks one long recycled passage above several short repeated phrases of the same total", () => {
    const long = filler("long", 40);
    const short = filler("short", 10);
    const report = run(
      chapter("c1", long, filler("a", 20), short),
      chapter("c2", short, filler("b", 20)),
      chapter("c3", short, filler("c", 20)),
      chapter("c4", short, filler("d", 20), long),
      chapter("c5", short, filler("e", 20)),
    );
    expect(report.clusters).toHaveLength(2);
    expect(report.clusters.map((c) => c.redundantWords)).toEqual([40, 40]);
    expect(report.clusters[0].members[0].text).toBe(long);
  });

  it("keeps a phrase separate from a longer passage that happens to run into it", () => {
    const phrase = filler("q", 10);
    const report = run(
      chapter("c1", `${PASSAGE} alpha ${phrase}`),
      chapter("c2", `${PASSAGE} beta ${phrase}`),
      chapter("c3", filler("x", 20), phrase, filler("y", 20)),
      chapter("c4", filler("z", 20), PASSAGE, filler("w", 20)),
    );
    expect(report.clusters).toHaveLength(2);
    const chaptersOf = (needle: string) =>
      report.clusters
        .find((c) => c.members.some((m) => m.chapterId === needle))
        ?.members.map((m) => m.chapterId);
    expect(chaptersOf("c3")).toEqual(["c1", "c2", "c3"]);
    expect(chaptersOf("c4")).toEqual(["c1", "c2", "c4"]);
  });

  it("returns null when cancelled", () => {
    expect(
      findRepeatedPassages([chapter("c1", PASSAGE), chapter("c2", PASSAGE)], {
        isCancelled: () => true,
      }),
    ).toBeNull();
  });
});
