import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { createAgentRun, getAgentRun } from "@/db/operations/agentRuns";
import { updateAppSettings } from "@/db/operations/settings";
import { invokeAgentForRun } from "./runner";
import type { Agent } from "./types";

const projectId = "11111111-1111-4111-a111-111111111111";

beforeEach(async () => {
  await Promise.all([db.projects.clear(), db.agentRuns.clear()]);
  await db.projects.put({
    id: projectId,
    title: "T",
    description: "",
    genre: "",
    targetWordCount: 0,
    mode: "prose",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
});

// kind="manual" so applyDefinitionOverride no-ops (PIPELINE_AGENT_KINDS only
// covers reader / orchestrator / editor / verifier). The agent never reaches
// runAgent in these tests because the API-key check throws first.
function stubAgent(): Agent {
  return {
    id: "test:1",
    kind: "manual",
    buildMessages: () => [],
    agentContext: { projectId, agentKind: "manual" },
  };
}

describe("invokeAgentForRun — API key gate", () => {
  it("throws when the resolved provider has no API key", async () => {
    // Default AppSettings have all providerApiKeys set to "" — the gate fires.
    const run = await createAgentRun({ projectId, name: "no-key" });

    await expect(
      invokeAgentForRun({ runId: run.id, agent: stubAgent() }),
    ).rejects.toThrow(/No API key configured for provider/);
  });

  it("does NOT write status='error' on the throw (withRunErrorCapture owns that)", async () => {
    // Critical regression guard: previously each callsite wrote status="error"
    // and then withRunErrorCapture wrote it again. The deepening removes the
    // helper's status write. If a future change re-introduces it, that's a
    // double-write bug.
    const run = await createAgentRun({ projectId, name: "no-key-no-write" });
    const before = await getAgentRun(run.id);
    expect(before?.status).not.toBe("error");

    await expect(
      invokeAgentForRun({ runId: run.id, agent: stubAgent() }),
    ).rejects.toThrow();

    const after = await getAgentRun(run.id);
    expect(after?.status).toBe(before?.status);
    expect(after?.status).not.toBe("error");
    expect(after?.statusReason).toBe(before?.statusReason);
  });

  it("uses the agent's modelOverride provider when resolving the key", async () => {
    // openrouter has a key, anthropic does not. An agent overriding to
    // anthropic should still throw despite the openrouter key being set.
    await updateAppSettings({
      providerApiKeys: {
        openrouter: "or-key",
        anthropic: "",
        openai: "",
        grok: "",
        zai: "",
        google: "",
        vertex: "",
      },
    });
    const run = await createAgentRun({ projectId, name: "override-miss" });
    const agent: Agent = {
      ...stubAgent(),
      modelOverride: { provider: "anthropic", model: "claude" },
    };

    await expect(invokeAgentForRun({ runId: run.id, agent })).rejects.toThrow(
      /anthropic/,
    );
  });
});
