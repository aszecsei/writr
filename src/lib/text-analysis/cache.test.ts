import { beforeEach, describe, expect, it } from "vitest";
import type { ChapterId, ProjectId } from "@/db/schemas";
import { analyzeSentences } from "./analyze";
import {
  clearAnalysisCache,
  getCachedAnalysis,
  MAX_ENTRIES,
  makeAnalysisCacheKey,
  setCachedAnalysis,
} from "./cache";

const DELIMITERS = { open: "[", close: "]" };

function makeAnalysis(chapterId: string) {
  return analyzeSentences(
    {
      chapterId: chapterId as ChapterId,
      projectId: "project-1" as ProjectId,
      updatedAt: "2026-06-10T00:00:00.000Z",
    },
    [],
  );
}

describe("analysis cache", () => {
  beforeEach(() => {
    clearAnalysisCache();
  });

  it("returns a cached analysis for a matching key", () => {
    const key = makeAnalysisCacheKey("2026-06-10T00:00:00.000Z", DELIMITERS);
    const analysis = makeAnalysis("ch-1");
    setCachedAnalysis("ch-1", key, analysis);
    expect(getCachedAnalysis("ch-1", key)).toBe(analysis);
  });

  it("misses when updatedAt changes", () => {
    const oldKey = makeAnalysisCacheKey("2026-06-09T00:00:00.000Z", DELIMITERS);
    const newKey = makeAnalysisCacheKey("2026-06-10T00:00:00.000Z", DELIMITERS);
    setCachedAnalysis("ch-1", oldKey, makeAnalysis("ch-1"));
    expect(getCachedAnalysis("ch-1", newKey)).toBeNull();
  });

  it("misses when hole delimiters change", () => {
    const bracketKey = makeAnalysisCacheKey("2026-06-10", DELIMITERS);
    const braceKey = makeAnalysisCacheKey("2026-06-10", {
      open: "{{",
      close: "}}",
    });
    setCachedAnalysis("ch-1", bracketKey, makeAnalysis("ch-1"));
    expect(getCachedAnalysis("ch-1", braceKey)).toBeNull();
  });

  it("misses for an unknown chapter", () => {
    const key = makeAnalysisCacheKey("2026-06-10", DELIMITERS);
    expect(getCachedAnalysis("ch-unknown", key)).toBeNull();
  });

  it("evicts the least recently used entry beyond the cap", () => {
    const key = makeAnalysisCacheKey("2026-06-10", DELIMITERS);
    for (let i = 0; i < MAX_ENTRIES; i++) {
      setCachedAnalysis(`ch-${i}`, key, makeAnalysis(`ch-${i}`));
    }
    // Touch ch-0 so ch-1 becomes the oldest, then overflow the cap.
    getCachedAnalysis("ch-0", key);
    setCachedAnalysis(
      `ch-${MAX_ENTRIES}`,
      key,
      makeAnalysis(`ch-${MAX_ENTRIES}`),
    );

    expect(getCachedAnalysis("ch-0", key)).not.toBeNull();
    expect(getCachedAnalysis("ch-1", key)).toBeNull();
    expect(getCachedAnalysis(`ch-${MAX_ENTRIES}`, key)).not.toBeNull();
  });
});
