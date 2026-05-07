import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createAgentRun, getAgentRun } from "@/db/operations/agentRuns";
import type { ProjectId } from "@/db/schemas";
import type { AiContext } from "../../types";

// Mock the loop before importing runEngine so the engine binds the mock.
const runReaderLoopMock = vi.fn();

vi.mock("./readerLoop", () => ({
  runReaderLoop: (...args: unknown[]) => runReaderLoopMock(...args),
  BUDGET_EXCEEDED_REASON: "Budget exceeded",
}));

const { startReaderPhase } = await import("./runEngine");

const projectId = "11111111-1111-4111-a111-111111111111" as ProjectId;

const buildContext: () => Promise<AiContext> = async () =>
  ({
    project: { id: projectId, title: "T", description: "", genre: "" },
    chapters: [],
    characters: [],
    locations: [],
    timelineEvents: [],
    styleGuideEntries: [],
    worldbuildingDocs: [],
    agentNotes: [],
    agentQuestions: [],
    snapshotManifests: [],
    proposedEdits: [],
    workUnits: [],
    editPlans: [],
    chapterSummaries: [],
    verifications: [],
    readerBibleLogEntries: [],
    readerBibleViewEntries: [],
    storyOutline: null,
  }) as unknown as AiContext;

beforeEach(async () => {
  await db.agentRuns.clear();
  runReaderLoopMock.mockReset();
});

describe("startReaderPhase error capture", () => {
  it("transitions the run to error and records failedFromStatus when the loop throws", async () => {
    const run = await createAgentRun({ projectId, name: "Boom" });
    runReaderLoopMock.mockRejectedValueOnce(
      new Error("openrouter request failed (status 500): terminated"),
    );

    await expect(
      startReaderPhase({ runId: run.id, projectId, buildContext }),
    ).rejects.toThrow(/openrouter request failed/);

    const updated = await getAgentRun(run.id);
    expect(updated?.status).toBe("error");
    expect(updated?.failedFromStatus).toBe("reading");
    expect(updated?.statusReason).toMatch(/openrouter request failed/);
  });

  it("does not flip status to error when the loop throws after the abort signal fired", async () => {
    const run = await createAgentRun({ projectId, name: "Cancel" });
    // The mocked loop waits for abort and rejects with an abort-style error.
    runReaderLoopMock.mockImplementationOnce(
      async ({ signal }: { signal: AbortSignal }) =>
        new Promise<void>((_, reject) => {
          signal.addEventListener("abort", () =>
            reject(new Error("aborted by user")),
          );
        }),
    );

    const { cancelRun, getRunController } = await import("./runEngine");
    const start = startReaderPhase({
      runId: run.id,
      projectId,
      buildContext,
    });
    // startReaderPhase awaits getAgentRun (a fake-indexeddb macrotask) before
    // registering the controller, so we poll on a timer macrotask until the
    // controller is registered, then cancel.
    while (!getRunController(run.id)) {
      await new Promise((r) => setTimeout(r, 0));
    }
    cancelRun(run.id);

    await expect(start).rejects.toThrow(/aborted by user/);

    const updated = await getAgentRun(run.id);
    expect(updated?.status).not.toBe("error");
    expect(updated?.failedFromStatus).toBeNull();
  });
});
