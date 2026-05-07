import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../database";
import type { AgentRunId, ProjectId } from "../schemas";
import {
  clearProposedAnswer,
  countAgentQuestionsOpen,
  createAgentQuestion,
  proposeAgentQuestionAnswer,
} from "./agentQuestions";

const projectId = "b2222222-2222-4222-a222-222222222222" as ProjectId;
const runId = "c3333333-3333-4333-a333-333333333333" as AgentRunId;
const otherRunId = "d4444444-4444-4444-a444-444444444444" as AgentRunId;

beforeEach(async () => {
  await db.agentQuestions.clear();
});

describe("proposeAgentQuestionAnswer", () => {
  it("writes the three proposal fields and leaves status untouched", async () => {
    const q = await createAgentQuestion({
      projectId,
      runId,
      description: "Why does the locket reappear?",
    });
    expect(q.status).toBe("open");
    expect(q.proposedAnswer).toBeNull();

    await proposeAgentQuestionAnswer({
      id: q.id,
      proposedAnswer: "Mother gave it to her in chapter 2.",
      passNumber: 3,
    });

    const after = await db.agentQuestions.get(q.id);
    expect(after?.status).toBe("open");
    expect(after?.proposedAnswer).toBe("Mother gave it to her in chapter 2.");
    expect(after?.proposedByPassNumber).toBe(3);
    expect(after?.proposedAt).not.toBeNull();
    expect(after?.updatedAt).not.toBe(q.updatedAt);
  });
});

describe("clearProposedAnswer", () => {
  it("nulls all three proposal fields", async () => {
    const q = await createAgentQuestion({
      projectId,
      runId,
      description: "Anything?",
    });
    await proposeAgentQuestionAnswer({
      id: q.id,
      proposedAnswer: "Yes.",
      passNumber: 3,
    });

    await clearProposedAnswer(q.id);

    const after = await db.agentQuestions.get(q.id);
    expect(after?.proposedAnswer).toBeNull();
    expect(after?.proposedAt).toBeNull();
    expect(after?.proposedByPassNumber).toBeNull();
    expect(after?.status).toBe("open");
  });
});

describe("countAgentQuestionsOpen", () => {
  it("counts only questions with status='open' for the given run", async () => {
    const a = await createAgentQuestion({
      projectId,
      runId,
      description: "A",
    });
    await createAgentQuestion({ projectId, runId, description: "B" });
    const c = await createAgentQuestion({
      projectId,
      runId,
      description: "C",
    });
    await createAgentQuestion({
      projectId,
      runId: otherRunId,
      description: "D",
    });

    // Mark one answered, one dismissed.
    await db.agentQuestions.update(a.id, { status: "answered" });
    await db.agentQuestions.update(c.id, { status: "dismissed" });

    expect(await countAgentQuestionsOpen(runId)).toBe(1);
    expect(await countAgentQuestionsOpen(otherRunId)).toBe(1);
  });

  it("returns 0 when no questions exist for the run", async () => {
    expect(await countAgentQuestionsOpen(runId)).toBe(0);
  });
});
