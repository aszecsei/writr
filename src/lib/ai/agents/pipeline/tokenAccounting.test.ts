import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createAgentRun, getAgentRun } from "@/db/operations/agentRuns";
import type { IterationEndInfo, RunAgentCallbacks } from "../types";
import { withTokenAccounting } from "./tokenAccounting";

const PROJECT_ID = "00000000-0000-4000-8000-aaaaaaaaaaaa";

async function makeRun(): Promise<string> {
  // Seed a project row first so the run's projectFk passes Zod validation.
  await db.projects.put({
    id: PROJECT_ID,
    title: "test project",
    description: "",
    genre: "",
    targetWordCount: 0,
    mode: "prose",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
  const run = await createAgentRun({
    projectId: PROJECT_ID,
    name: "test run",
    modelOverrides: {
      reader: null,
      orchestrator: null,
      editor: null,
      verifier: null,
    },
  });
  return run.id;
}

function makeIterationInfo(
  overrides: Partial<IterationEndInfo> & Pick<IterationEndInfo, "messageId">,
): IterationEndInfo {
  return {
    iteration: 1,
    content: "ok",
    durationMs: 100,
    finishReason: "stop",
    ...overrides,
  };
}

describe("withTokenAccounting", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });
  afterEach(async () => {
    await db.delete();
  });

  it("increments totalTokenUsage and overwrites lastIterationPromptTokens from real usage", async () => {
    const runId = await makeRun();
    const inner = vi.fn();
    const callbacks: RunAgentCallbacks = { onIterationEnd: inner };
    const wrapped = withTokenAccounting(runId, callbacks);

    await wrapped.onIterationEnd?.(
      makeIterationInfo({
        messageId: "m1",
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 50,
          total_tokens: 1050,
        },
      }),
    );
    await wrapped.onIterationEnd?.(
      makeIterationInfo({
        messageId: "m2",
        iteration: 2,
        usage: {
          prompt_tokens: 1500,
          completion_tokens: 30,
          total_tokens: 1530,
        },
      }),
    );

    const run = await getAgentRun(runId);
    expect(run?.totalTokenUsage).toEqual({
      promptTokens: 2500,
      completionTokens: 80,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });
    // Overwrite, not sum — the meter reflects "current" pressure.
    expect(run?.lastIterationPromptTokens).toBe(1500);
    // The wrapped callback still calls through to the inner one.
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("leaves usage counters untouched when usage is undefined", async () => {
    const runId = await makeRun();
    const inner = vi.fn();
    const wrapped = withTokenAccounting(runId, { onIterationEnd: inner });

    // First, seed a real usage so we have a non-zero baseline.
    await wrapped.onIterationEnd?.(
      makeIterationInfo({
        messageId: "m1",
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 },
      }),
    );

    // Now pass an iteration with no usage (e.g., upstream stripped it).
    await wrapped.onIterationEnd?.(
      makeIterationInfo({ messageId: "m2", iteration: 2 }),
    );

    const run = await getAgentRun(runId);
    expect(run?.totalTokenUsage).toEqual({
      promptTokens: 100,
      completionTokens: 10,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });
    expect(run?.lastIterationPromptTokens).toBe(100);
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("persists cache_creation_tokens and cache_read_tokens when present", async () => {
    const runId = await makeRun();
    const wrapped = withTokenAccounting(runId, {});

    await wrapped.onIterationEnd?.(
      makeIterationInfo({
        messageId: "m1",
        usage: {
          prompt_tokens: 1500,
          completion_tokens: 50,
          total_tokens: 1550,
          cache_creation_tokens: 200,
          cache_read_tokens: 800,
        },
      }),
    );
    await wrapped.onIterationEnd?.(
      makeIterationInfo({
        messageId: "m2",
        iteration: 2,
        usage: {
          prompt_tokens: 1500,
          completion_tokens: 30,
          total_tokens: 1530,
          cache_read_tokens: 1300,
        },
      }),
    );

    const run = await getAgentRun(runId);
    expect(run?.totalTokenUsage).toEqual({
      promptTokens: 3000,
      completionTokens: 80,
      cacheCreationTokens: 200,
      cacheReadTokens: 2100,
    });
  });

  it("works when no inner onIterationEnd was provided", async () => {
    const runId = await makeRun();
    const wrapped = withTokenAccounting(runId, {});

    await expect(
      wrapped.onIterationEnd?.(
        makeIterationInfo({
          messageId: "m1",
          usage: {
            prompt_tokens: 200,
            completion_tokens: 5,
            total_tokens: 205,
          },
        }),
      ),
    ).resolves.toBeUndefined();

    const run = await getAgentRun(runId);
    expect(run?.totalTokenUsage.promptTokens).toBe(200);
    expect(run?.lastIterationPromptTokens).toBe(200);
  });

  it("forwards all non-iteration-end callbacks unchanged", () => {
    const onIterationStart = vi.fn();
    const onChunk = vi.fn();
    const onToolCallsCollected = vi.fn();
    const onToolCallUpdate = vi.fn();
    const wrapped = withTokenAccounting("fake-run-id", {
      onIterationStart,
      onChunk,
      onToolCallsCollected,
      onToolCallUpdate,
    });

    expect(wrapped.onIterationStart).toBe(onIterationStart);
    expect(wrapped.onChunk).toBe(onChunk);
    expect(wrapped.onToolCallsCollected).toBe(onToolCallsCollected);
    expect(wrapped.onToolCallUpdate).toBe(onToolCallUpdate);
  });
});
