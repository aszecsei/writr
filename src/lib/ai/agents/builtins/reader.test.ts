import { describe, expect, it } from "vitest";
import type { AgentRunId, Chapter, ChapterId, ProjectId } from "@/db/schemas";
import type { AiContext } from "../../types";
import { buildComprehensionBriefing, makeReaderAgent } from "./reader";

const ts = "2024-01-01T00:00:00.000Z";
const runId = "00000000-0000-4000-8000-000000000abc" as AgentRunId;
const projectId = "00000000-0000-4000-8000-000000000def" as ProjectId;

function makeContext(): AiContext {
  return {
    projectTitle: "Untitled",
    projectDescription: "",
    genre: "",
    characters: [],
    locations: [],
    styleGuide: [],
    timelineEvents: [],
    worldbuildingDocs: [],
    relationships: [],
    outlineGridColumns: [],
    outlineGridRows: [],
    outlineGridCells: [],
    chapters: [],
  };
}

function makeChapter(): Chapter {
  return {
    id: "00000000-0000-4000-8000-000000000001" as ChapterId,
    projectId,
    title: "The Green Light",
    order: 0,
    content: "Gatsby reached toward the green light at the end of the dock.",
    synopsis: "",
    status: "draft",
    wordCount: 12,
    createdAt: ts,
    updatedAt: ts,
  };
}

describe("makeReaderAgent — comprehension mode", () => {
  it("uses the comprehension tool whitelist with chapter read-back tools but not propose_answer", () => {
    const agent = makeReaderAgent({
      runId,
      projectId,
      passNumber: 1,
      mode: "comprehension",
      chapter: makeChapter(),
      chapterIndex: 1,
      totalChapters: 1,
      context: makeContext(),
    });
    // Bible/observation tools are required.
    expect(agent.allowedToolIds).toContain("bible_read");
    expect(agent.allowedToolIds).toContain("bible_write");
    expect(agent.allowedToolIds).toContain("note");
    expect(agent.allowedToolIds).toContain("question");
    // Read-back tools are now allowed; forward-only is enforced via the
    // `maxReadableChapterOrder` bound on the agent context, not by tool
    // omission.
    expect(agent.allowedToolIds).toContain("read_chapter");
    expect(agent.allowedToolIds).toContain("read_chapter_range");
    expect(agent.allowedToolIds).toContain("search_chapter");
    expect(agent.allowedToolIds).toContain("search_chapters");
    // Chapter list permission is scoped — readers cannot list characters/etc.
    expect(agent.allowedToolIds).toContain("list:chapter");
    expect(agent.allowedToolIds).not.toContain("list:character");
    expect(agent.allowedToolIds).not.toContain("list");
    // Still forbidden: search_project (would expose authored bible) and
    // propose_answer (self-answer-only).
    expect(agent.allowedToolIds).not.toContain("search_project");
    expect(agent.allowedToolIds).not.toContain("propose_answer");
  });

  it("encodes mode + chapter index into the agent id", () => {
    const agent = makeReaderAgent({
      runId,
      projectId,
      passNumber: 1,
      mode: "comprehension",
      chapter: makeChapter(),
      chapterIndex: 4,
      totalChapters: 9,
      context: makeContext(),
    });
    expect(agent.id).toBe(`reader:${runId}:pass-1:comprehension:ch-4`);
  });

  it("inlines the chapter content into the briefing built by buildComprehensionBriefing", () => {
    const chapter = makeChapter();
    const briefing = buildComprehensionBriefing({
      chapter,
      chapterIndex: 1,
      totalChapters: 1,
      segmentPosition: "first",
    });
    expect(briefing).toContain('mode="comprehension"');
    expect(briefing).toContain(chapter.content);
  });

  it("threads readableChapterIds into the agent context for forward-only enforcement", () => {
    const chapter = makeChapter();
    const readableChapterIds = new Set([chapter.id]);
    const agent = makeReaderAgent({
      runId,
      projectId,
      passNumber: 1,
      mode: "comprehension",
      chapter,
      chapterIndex: 1,
      totalChapters: 1,
      readableChapterIds,
      context: makeContext(),
    });
    expect(agent.agentContext.readableChapterIds).toBe(readableChapterIds);
  });

  it("emits a 'continuing' framing for non-first chapters in a segment", () => {
    const chapter = makeChapter();
    const first = buildComprehensionBriefing({
      chapter,
      chapterIndex: 1,
      totalChapters: 5,
      segmentPosition: "first",
    });
    const continuing = buildComprehensionBriefing({
      chapter,
      chapterIndex: 2,
      totalChapters: 5,
      segmentPosition: "continuing",
    });
    expect(first).toContain("Earlier chapters");
    expect(continuing).toContain("Prior chapters in this segment are above");
  });

  it("throws when chapter inputs are missing", () => {
    expect(() =>
      makeReaderAgent({
        runId,
        projectId,
        passNumber: 1,
        mode: "comprehension",
        context: makeContext(),
      }),
    ).toThrow(/comprehension mode requires/);
  });

  it("stamps passNumber on the tool execution context", () => {
    const agent = makeReaderAgent({
      runId,
      projectId,
      passNumber: 1,
      mode: "comprehension",
      chapter: makeChapter(),
      chapterIndex: 1,
      totalChapters: 1,
      context: makeContext(),
    });
    expect(agent.agentContext.passNumber).toBe(1);
  });
});

describe("makeReaderAgent — thematic mode", () => {
  it("uses the thematic tool whitelist with search + read but no propose_answer", () => {
    const agent = makeReaderAgent({
      runId,
      projectId,
      passNumber: 2,
      mode: "thematic",
      context: makeContext(),
    });
    expect(agent.allowedToolIds).toContain("search_chapters");
    expect(agent.allowedToolIds).toContain("read_chapter_range");
    expect(agent.allowedToolIds).toContain("bible_write");
    expect(agent.allowedToolIds).not.toContain("propose_answer");
    expect(agent.allowedToolIds).not.toContain("get:outline");
  });

  it("encodes mode into the agent id and omits chapter suffix", () => {
    const agent = makeReaderAgent({
      runId,
      projectId,
      passNumber: 2,
      mode: "thematic",
      context: makeContext(),
    });
    expect(agent.id).toBe(`reader:${runId}:pass-2:thematic`);
  });

  it("references the thematic namespaces in the system prompt", () => {
    const agent = makeReaderAgent({
      runId,
      projectId,
      passNumber: 2,
      mode: "thematic",
      context: makeContext(),
    });
    expect(agent.systemPrompt).toContain("motifs/");
    expect(agent.systemPrompt).toContain("symbols/");
    expect(agent.systemPrompt).toContain("subtext/");
  });
});

describe("makeReaderAgent — self-answer mode", () => {
  it("includes propose_answer in the tool whitelist", () => {
    const agent = makeReaderAgent({
      runId,
      projectId,
      passNumber: 3,
      mode: "self-answer",
      context: makeContext(),
    });
    expect(agent.allowedToolIds).toContain("propose_answer");
    expect(agent.allowedToolIds).toContain("list_questions");
    expect(agent.allowedToolIds).toContain("read_chapter_range");
  });

  it("encodes mode into the agent id", () => {
    const agent = makeReaderAgent({
      runId,
      projectId,
      passNumber: 3,
      mode: "self-answer",
      context: makeContext(),
    });
    expect(agent.id).toBe(`reader:${runId}:pass-3:self-answer`);
  });

  it("instructs the model to call list_questions first", () => {
    const agent = makeReaderAgent({
      runId,
      projectId,
      passNumber: 3,
      mode: "self-answer",
      context: makeContext(),
    });
    expect(agent.systemPrompt).toMatch(/list_questions\(status="open"\)/);
    expect(agent.systemPrompt).toContain("propose_answer");
  });
});
