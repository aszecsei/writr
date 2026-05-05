import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../database";
import {
  createAgentRun,
  deleteAgentRun,
  getAgentRun,
  updateAgentRunStatus,
  updateBudgetTokens,
} from "./agentRuns";

const projectId = "a1111111-1111-4111-a111-111111111111";

const ts = "2024-01-01T00:00:00.000Z";

function uuid(seed: number): string {
  const hex = seed.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

describe("updateBudgetTokens", () => {
  beforeEach(async () => {
    await db.agentRuns.clear();
  });

  it("updates budgetTokens on a positive integer", async () => {
    const run = await createAgentRun({
      projectId,
      name: "Run A",

      budgetTokens: 1_000_000,
    });

    await updateBudgetTokens(run.id, 5_000_000);

    const updated = await getAgentRun(run.id);
    expect(updated?.budgetTokens).toBe(5_000_000);
    expect(updated?.updatedAt).not.toBe(run.updatedAt);
  });

  it("rejects zero", async () => {
    const run = await createAgentRun({
      projectId,
      name: "Run B",
    });

    await expect(updateBudgetTokens(run.id, 0)).rejects.toThrow(
      /positive integer/,
    );

    const unchanged = await getAgentRun(run.id);
    expect(unchanged?.budgetTokens).toBe(1_000_000);
  });

  it("rejects negative numbers", async () => {
    const run = await createAgentRun({
      projectId,
      name: "Run C",
    });

    await expect(updateBudgetTokens(run.id, -100)).rejects.toThrow(
      /positive integer/,
    );
  });

  it("rejects non-integers", async () => {
    const run = await createAgentRun({
      projectId,
      name: "Run D",
    });

    await expect(updateBudgetTokens(run.id, 1.5)).rejects.toThrow(
      /positive integer/,
    );
  });
});

describe("deleteAgentRun", () => {
  beforeEach(async () => {
    await db.transaction(
      "rw",
      [
        db.agentRuns,
        db.readerBibleLog,
        db.readerBibleView,
        db.agentNotes,
        db.agentQuestions,
        db.workUnits,
        db.editPlans,
        db.proposedEdits,
        db.verifications,
        db.snapshotManifests,
        db.chapterSnapshots,
      ],
      async () => {
        await db.agentRuns.clear();
        await db.readerBibleLog.clear();
        await db.readerBibleView.clear();
        await db.agentNotes.clear();
        await db.agentQuestions.clear();
        await db.workUnits.clear();
        await db.editPlans.clear();
        await db.proposedEdits.clear();
        await db.verifications.clear();
        await db.snapshotManifests.clear();
        await db.chapterSnapshots.clear();
      },
    );
  });

  async function seedRunWithChildren(runId: string): Promise<void> {
    const chapterId = uuid(0xc0);
    const workUnitId = uuid(0xc1);

    await db.readerBibleLog.add({
      id: uuid(0x10),
      projectId,
      runId,
      path: "characters/alice",
      op: "set",
      value: { name: "Alice" },
      asOfChapter: 1,
      agentMessageId: null,
      createdAt: ts,
    });
    await db.readerBibleView.add({
      id: uuid(0x11),
      projectId,
      runId,
      path: "characters/alice",
      value: { name: "Alice" },
      lastUpdatedAt: ts,
      lastLogEntryId: uuid(0x10),
    });
    await db.agentNotes.add({
      id: uuid(0x12),
      projectId,
      runId,
      chapterId: null,
      category: "plot",
      severity: "minor",
      description: "Pacing dips in act 2.",
      references: [],
      status: "open",
      addressedByWorkUnitId: null,
      sourceVerificationId: null,
      createdAt: ts,
      updatedAt: ts,
    });
    await db.agentQuestions.add({
      id: uuid(0x13),
      projectId,
      runId,
      description: "Is the ring an heirloom?",
      references: [],
      status: "open",
      humanAnswer: null,
      proposedAnswer: null,
      proposedAt: null,
      proposedByPassNumber: null,
      createdAt: ts,
      updatedAt: ts,
    });
    await db.workUnits.add({
      id: workUnitId,
      projectId,
      runId,
      tier: 0,
      goal: "Tighten the opening.",
      requiredBeats: [],
      constraints: [],
      placement: { chapterId, position: "replace" },
      targetLengthWords: null,
      bibleRefs: [],
      sourceNoteIds: [],
      dependencies: [],
      status: "planned",
      ownerEditorMessageId: null,
      createdAt: ts,
      updatedAt: ts,
    });
    await db.editPlans.add({
      id: uuid(0x14),
      projectId,
      runId,
      status: "draft",
      currentTier: 0,
      tiers: [],
      createdAt: ts,
      updatedAt: ts,
    });
    await db.proposedEdits.add({
      id: uuid(0x15),
      projectId,
      runId,
      workUnitId,
      chapterId,
      kind: "replace_range",
      newContent: "New text.",
      rationale: "",
      status: "pending",
      createdAt: ts,
      updatedAt: ts,
    });
    await db.verifications.add({
      id: uuid(0x16),
      projectId,
      runId,
      tier: 0,
      workUnitId: null,
      goalAchieved: true,
      contradictions: [],
      continuityBreaks: [],
      voiceMismatches: [],
      notes: [],
      createdAt: ts,
    });
    await db.snapshotManifests.add({
      id: uuid(0x17),
      projectId,
      runId,
      tierNumber: 0,
      name: "Tier 0 baseline",
      chapterSnapshotIds: [uuid(0xc2)],
      readerBibleSnapshot: { view: [], logCutoffEntryId: null },
      notesSnapshot: [],
      workUnitsSnapshot: [],
      createdAt: ts,
    });
    await db.chapterSnapshots.add({
      id: uuid(0xc2),
      chapterId,
      projectId,
      name: "Pre-tier-0",
      content: "Original chapter text.",
      wordCount: 3,
      createdAt: ts,
    });
  }

  async function countRunRows(runId: string): Promise<Record<string, number>> {
    return {
      readerBibleLog: await db.readerBibleLog.where({ runId }).count(),
      readerBibleView: await db.readerBibleView.where({ runId }).count(),
      agentNotes: await db.agentNotes.where({ runId }).count(),
      agentQuestions: await db.agentQuestions.where({ runId }).count(),
      workUnits: await db.workUnits.where({ runId }).count(),
      editPlans: await db.editPlans.where({ runId }).count(),
      proposedEdits: await db.proposedEdits.where({ runId }).count(),
      verifications: await db.verifications.where({ runId }).count(),
      snapshotManifests: await db.snapshotManifests.where({ runId }).count(),
    };
  }

  it("throws when the run does not exist", async () => {
    await expect(deleteAgentRun(uuid(0x99))).rejects.toThrow(/not found/);
  });

  it("refuses to delete an in-flight (non-terminal) run", async () => {
    const run = await createAgentRun({
      projectId,
      name: "In-flight",
    });
    await seedRunWithChildren(run.id);

    await expect(deleteAgentRun(run.id)).rejects.toThrow(
      /Cancel the run before deleting/,
    );

    expect(await getAgentRun(run.id)).toBeDefined();
    const counts = await countRunRows(run.id);
    for (const [_, n] of Object.entries(counts)) {
      expect(n).toBe(1);
    }
  });

  it("cascades to all run-scoped child tables on a terminal run", async () => {
    const run = await createAgentRun({
      projectId,
      name: "Done",
    });
    await seedRunWithChildren(run.id);
    await updateAgentRunStatus(run.id, "complete");

    await deleteAgentRun(run.id);

    expect(await getAgentRun(run.id)).toBeUndefined();
    const counts = await countRunRows(run.id);
    for (const [table, n] of Object.entries(counts)) {
      expect(n, `${table} should be empty`).toBe(0);
    }
  });

  it("preserves chapterSnapshots referenced by deleted manifests", async () => {
    const run = await createAgentRun({
      projectId,
      name: "Snapshot keep",
    });
    await seedRunWithChildren(run.id);
    await updateAgentRunStatus(run.id, "complete");

    await deleteAgentRun(run.id);

    const snap = await db.chapterSnapshots.get(uuid(0xc2));
    expect(snap).toBeDefined();
    expect(snap?.content).toBe("Original chapter text.");
  });

  it("does not affect another project's run rows", async () => {
    const runA = await createAgentRun({
      projectId,
      name: "A",
    });
    await seedRunWithChildren(runA.id);
    await updateAgentRunStatus(runA.id, "complete");

    const otherProjectId = "b2222222-2222-4222-a222-222222222222";
    const runB = await createAgentRun({
      projectId: otherProjectId,
      name: "B",
    });
    // Seed a single child row keyed on runB to ensure scoping is by runId.
    await db.readerBibleLog.add({
      id: uuid(0x20),
      projectId: otherProjectId,
      runId: runB.id,
      path: "characters/bob",
      op: "set",
      value: { name: "Bob" },
      asOfChapter: 1,
      agentMessageId: null,
      createdAt: ts,
    });

    await deleteAgentRun(runA.id);

    expect(await getAgentRun(runB.id)).toBeDefined();
    expect(await db.readerBibleLog.where({ runId: runB.id }).count()).toBe(1);
  });
});
