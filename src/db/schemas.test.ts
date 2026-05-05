import { describe, expect, it } from "vitest";
import {
  AgentQuestionSchema,
  AgentRunSchema,
  READER_BIBLE_TOP_LEVEL_PATHS,
  ReaderPassSchema,
} from "./schemas";

const ts = "2024-01-01T00:00:00.000Z";
const uuid = "11111111-1111-4111-a111-111111111111";

describe("ReaderPassSchema", () => {
  it("defaults `mode` to 'comprehension' when missing (back-compat with pre-mode rows)", () => {
    const parsed = ReaderPassSchema.parse({
      passNumber: 1,
      startedAt: ts,
    });
    expect(parsed.mode).toBe("comprehension");
  });

  it("accepts an explicit mode value", () => {
    const parsed = ReaderPassSchema.parse({
      passNumber: 2,
      mode: "thematic",
      startedAt: ts,
    });
    expect(parsed.mode).toBe("thematic");
  });

  it("rejects an unknown mode value", () => {
    expect(() =>
      ReaderPassSchema.parse({
        passNumber: 1,
        mode: "bogus",
        startedAt: ts,
      }),
    ).toThrow();
  });
});

describe("AgentRunSchema readerPasses backfill", () => {
  it("parses a run with a legacy readerPasses entry missing the mode field", () => {
    const run = AgentRunSchema.parse({
      id: uuid,
      projectId: uuid,
      name: "Legacy run",
      readerPasses: [
        {
          passNumber: 1,
          startedAt: ts,
          completedAt: ts,
          newBibleEntries: 5,
          newNotes: 2,
          newQuestions: 1,
        },
      ],
      createdAt: ts,
      updatedAt: ts,
    });
    expect(run.readerPasses[0].mode).toBe("comprehension");
  });
});

describe("AgentQuestionSchema proposal fields", () => {
  const baseInput = {
    id: uuid,
    projectId: uuid,
    runId: uuid,
    description: "Why?",
    createdAt: ts,
    updatedAt: ts,
  };

  it("defaults the three proposal fields to null when missing", () => {
    const q = AgentQuestionSchema.parse(baseInput);
    expect(q.proposedAnswer).toBeNull();
    expect(q.proposedAt).toBeNull();
    expect(q.proposedByPassNumber).toBeNull();
  });

  it("preserves a proposal once recorded", () => {
    const q = AgentQuestionSchema.parse({
      ...baseInput,
      proposedAnswer: "Because chapter 4 says so.",
      proposedAt: ts,
      proposedByPassNumber: 3,
    });
    expect(q.proposedAnswer).toBe("Because chapter 4 says so.");
    expect(q.proposedByPassNumber).toBe(3);
  });
});

describe("READER_BIBLE_TOP_LEVEL_PATHS", () => {
  it("includes the new thematic namespaces", () => {
    expect(READER_BIBLE_TOP_LEVEL_PATHS).toContain("motifs");
    expect(READER_BIBLE_TOP_LEVEL_PATHS).toContain("symbols");
    expect(READER_BIBLE_TOP_LEVEL_PATHS).toContain("subtext");
  });

  it("retains the comprehension namespaces", () => {
    expect(READER_BIBLE_TOP_LEVEL_PATHS).toContain("characters");
    expect(READER_BIBLE_TOP_LEVEL_PATHS).toContain("voice");
    expect(READER_BIBLE_TOP_LEVEL_PATHS).toContain("open_threads");
  });
});
