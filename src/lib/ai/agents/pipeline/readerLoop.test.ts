import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createAgentQuestion } from "@/db/operations/agentQuestions";
import { createAgentRun, getAgentRun } from "@/db/operations/agentRuns";
import { updateAppSettings } from "@/db/operations/settings";
import type { ProjectId } from "@/db/schemas";
import type { AiMessage } from "../../types";
import type { Agent } from "../types";

// Mock the runner before importing the loop so the loop binds the mock.
// invokeAgentForRun is the seam every readerLoop callsite goes through.
const invokeAgentForRunMock = vi.fn();

vi.mock("../runner", () => ({
  invokeAgentForRun: (...args: unknown[]) => invokeAgentForRunMock(...args),
}));

const { runReaderLoop } = await import("./readerLoop");

const projectId = "11111111-1111-4111-a111-111111111111" as ProjectId;
const ts = "2024-01-01T00:00:00.000Z";

function uuid<T extends string = string>(seed: number): T {
  const hex = seed.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}` as T;
}

async function seedProjectAndChapters(chapterCount: number): Promise<void> {
  await db.projects.put({
    id: projectId,
    title: "Test",
    description: "",
    genre: "",
    targetWordCount: 0,
    mode: "prose",
    createdAt: ts,
    updatedAt: ts,
  });
  for (let i = 0; i < chapterCount; i++) {
    await db.chapters.put({
      id: uuid(i + 1) as never,
      projectId,
      title: `Chapter ${i + 1}`,
      order: i,
      content: `Content ${i + 1}`,
      synopsis: "",
      status: "draft",
      wordCount: 2,
      parentChapterId: null,
      section: "manuscript",
      kind: "document",
      includeInCompile: true,
      pageBreakBefore: false,
      createdAt: ts,
      updatedAt: ts,
    });
  }
}

beforeEach(async () => {
  await Promise.all([
    db.projects.clear(),
    db.chapters.clear(),
    db.agentRuns.clear(),
    db.agentQuestions.clear(),
    db.agentNotes.clear(),
    db.readerBibleLog.clear(),
    db.readerBibleView.clear(),
  ]);
  invokeAgentForRunMock.mockReset();

  invokeAgentForRunMock.mockImplementation(async (_opts: { agent: Agent }) => ({
    iterations: 1,
    history: [],
    content: "ack",
    toolCalls: [],
    aborted: false,
    finishReason: "stop" as const,
  }));
});

const buildContext = async () => ({
  projectTitle: "Test",
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
});

describe("runReaderLoop — mode dispatch", () => {
  it("pass 1 dispatches comprehension once per chapter, pass 2 dispatches thematic, pass 3 dispatches self-answer", async () => {
    await seedProjectAndChapters(3);
    const run = await createAgentRun({
      projectId,
      name: "R1",

      budgetTokens: 1_000_000,
    });
    // Seed an open question so self-answer (pass 3) doesn't short-circuit.
    await createAgentQuestion({
      projectId,
      runId: run.id,
      description: "open?",
    });

    const result = await runReaderLoop({
      runId: run.id,
      projectId,
      maxPasses: 3,
      buildContext,
    });

    expect(result.passesCompleted).toBe(3);

    const agentIds: string[] = invokeAgentForRunMock.mock.calls.map(
      (call) => (call[0] as { agent: Agent }).agent.id,
    );
    // Pass 1: 3 comprehension agents (one per chapter).
    const pass1 = agentIds.filter((id) => id.includes(":pass-1:comprehension"));
    expect(pass1).toHaveLength(3);
    // Pass 2: exactly 1 thematic agent.
    const pass2 = agentIds.filter((id) => id.includes(":pass-2:thematic"));
    expect(pass2).toHaveLength(1);
    // Pass 3: exactly 1 self-answer agent.
    const pass3 = agentIds.filter((id) => id.includes(":pass-3:self-answer"));
    expect(pass3).toHaveLength(1);
  });

  it("records mode on each readerPasses entry", async () => {
    await seedProjectAndChapters(2);
    const run = await createAgentRun({
      projectId,
      name: "R2",

      budgetTokens: 1_000_000,
    });
    await createAgentQuestion({
      projectId,
      runId: run.id,
      description: "open?",
    });

    await runReaderLoop({
      runId: run.id,
      projectId,
      maxPasses: 3,
      buildContext,
    });

    const stored = await db.agentRuns.get(run.id);
    expect(stored?.readerPasses).toHaveLength(3);
    expect(stored?.readerPasses[0].mode).toBe("comprehension");
    expect(stored?.readerPasses[1].mode).toBe("thematic");
    expect(stored?.readerPasses[2].mode).toBe("self-answer");
  });

  it("self-answer skips invocation when no questions are open, but the pass still runs", async () => {
    await seedProjectAndChapters(2);
    const run = await createAgentRun({
      projectId,
      name: "R3",

      budgetTokens: 1_000_000,
    });
    // No open questions seeded.

    const result = await runReaderLoop({
      runId: run.id,
      projectId,
      maxPasses: 3,
      buildContext,
    });

    // Pass 3 still appended to the run, but no agent invocation for it.
    expect(result.passesCompleted).toBe(3);
    const agentIds: string[] = invokeAgentForRunMock.mock.calls.map(
      (call) => (call[0] as { agent: Agent }).agent.id,
    );
    expect(agentIds.filter((id) => id.includes(":self-answer"))).toHaveLength(
      0,
    );
  });

  it("passNumber continues from prior invocation when reader loop is re-entered", async () => {
    await seedProjectAndChapters(2);
    const run = await createAgentRun({
      projectId,
      name: "RReentry",
      budgetTokens: 1_000_000,
    });

    // First invocation: cap to 1 pass (comprehension over both chapters).
    await runReaderLoop({
      runId: run.id,
      projectId,
      maxPasses: 1,
      buildContext,
    });

    // Second invocation: thematic + self-answer. `passesCompleted` is the
    // per-invocation count, not the run total — that contract is what the
    // existing tests rely on, so it must stay 2 here.
    const second = await runReaderLoop({
      runId: run.id,
      projectId,
      maxPasses: 2,
      buildContext,
    });
    expect(second.passesCompleted).toBe(2);

    const stored = await getAgentRun(run.id);
    expect(stored?.readerPasses.map((p) => p.passNumber)).toEqual([1, 2, 3]);
    expect(stored?.readerPasses.map((p) => p.mode)).toEqual([
      "comprehension",
      "thematic",
      "self-answer",
    ]);
  });

  it("comprehension threads accumulating history across chapters within a segment", async () => {
    await seedProjectAndChapters(3);
    const run = await createAgentRun({
      projectId,
      name: "RAcc",

      budgetTokens: 1_000_000,
    });

    // Capture the `history` argument runAgent was invoked with on each call.
    // After each call we synthesise a one-iteration assistant turn and let the
    // loop chain it into the next chapter's history.
    const historiesSeen: AiMessage[][] = [];
    invokeAgentForRunMock.mockImplementation(
      async (opts: { agent: Agent; history?: AiMessage[] }) => {
        const history = opts.history ?? [];
        historiesSeen.push([...history]);
        return {
          iterations: 1,
          history: [...history, { role: "assistant", content: "ack" }],
          content: "ack",
          toolCalls: [],
          aborted: false,
          finishReason: "stop" as const,
        };
      },
    );

    await runReaderLoop({
      runId: run.id,
      projectId,
      maxPasses: 3,
      buildContext,
    });

    // Three chapters, three comprehension invocations within one segment:
    //   call 1 history: [user(briefing-1)]
    //   call 2 history: [user(briefing-1), assistant(ack-1), user(briefing-2)]
    //   call 3 history: [user(briefing-1), ..., user(briefing-3)]
    const comprehensionCalls = historiesSeen.slice(0, 3);
    expect(comprehensionCalls[0]).toHaveLength(1);
    expect(comprehensionCalls[0][0].role).toBe("user");
    expect(comprehensionCalls[1]).toHaveLength(3);
    expect(comprehensionCalls[2]).toHaveLength(5);

    // Soft reset NOT triggered (lastIterationPromptTokens stayed at 0), so
    // exactly one comprehension pass row covering all chapters.
    const stored = await db.agentRuns.get(run.id);
    const comprehensionPasses = stored?.readerPasses.filter(
      (p) => p.mode === "comprehension",
    );
    expect(comprehensionPasses).toHaveLength(1);
    expect(comprehensionPasses?.[0].firstChapterOrder).toBe(0);
    expect(comprehensionPasses?.[0].lastChapterOrder).toBe(2);
  });

  it("comprehension soft-resets to a new pass when prompt tokens cross the threshold", async () => {
    await seedProjectAndChapters(4);
    // Lower the threshold so we can trip it deliberately.
    await updateAppSettings({ comprehensionContextThreshold: 1_000 });

    const run = await createAgentRun({
      projectId,
      name: "RReset",

      budgetTokens: 1_000_000,
    });

    let comprehensionCallIndex = 0;
    invokeAgentForRunMock.mockImplementation(
      async (opts: { agent: Agent; history?: AiMessage[] }) => {
        const history = opts.history ?? [];
        const isComprehension = opts.agent.id.includes(":comprehension");
        if (isComprehension) {
          comprehensionCallIndex += 1;
          // After the second comprehension chapter completes, simulate a
          // big prompt iteration that crosses the threshold.
          const promptTokens = comprehensionCallIndex === 2 ? 5_000 : 100;
          const { updateAgentRun } = await import("@/db/operations/agentRuns");
          await updateAgentRun(run.id, {
            lastIterationPromptTokens: promptTokens,
          });
        }
        return {
          iterations: 1,
          history: [...history, { role: "assistant", content: "ack" }],
          content: "ack",
          toolCalls: [],
          aborted: false,
          finishReason: "stop" as const,
        };
      },
    );

    await runReaderLoop({
      runId: run.id,
      projectId,
      maxPasses: 12,
      buildContext,
    });

    const stored = await getAgentRun(run.id);
    const comprehensionPasses =
      stored?.readerPasses.filter((p) => p.mode === "comprehension") ?? [];

    // Threshold crossed after chapter 2 (order=1) → segment 1 covers ch
    // order 0-1; segment 2 starts at order 2 and runs to end.
    expect(comprehensionPasses).toHaveLength(2);
    expect(comprehensionPasses[0].firstChapterOrder).toBe(0);
    expect(comprehensionPasses[0].lastChapterOrder).toBe(1);
    expect(comprehensionPasses[1].firstChapterOrder).toBe(2);
    expect(comprehensionPasses[1].lastChapterOrder).toBe(3);

    // Restore default for other tests.
    await updateAppSettings({ comprehensionContextThreshold: 80_000 });
  });

  it("loop terminates when self-answer leaves no open questions remaining", async () => {
    await seedProjectAndChapters(1);
    const run = await createAgentRun({
      projectId,
      name: "R4",

      budgetTokens: 1_000_000,
    });
    // Open question that will be marked answered during the self-answer pass.
    const q = await createAgentQuestion({
      projectId,
      runId: run.id,
      description: "open?",
    });

    invokeAgentForRunMock.mockImplementation(async (opts: { agent: Agent }) => {
      // Simulate the self-answer pass fully resolving the only open question
      // (a human Accept happening mid-run).
      if (opts.agent.id.includes(":self-answer")) {
        await db.agentQuestions.update(q.id, { status: "answered" });
      }
      return {
        iterations: 1,
        history: [],
        content: "ack",
        toolCalls: [],
        aborted: false,
        finishReason: "stop" as const,
      };
    });

    const result = await runReaderLoop({
      runId: run.id,
      projectId,
      maxPasses: 5,
      buildContext,
    });

    // Comprehension (1) + thematic (1) + self-answer (1) — should not iterate
    // further once questions hit 0.
    expect(result.passesCompleted).toBe(3);
    expect(result.reason).toBe("delta");
  });
});
