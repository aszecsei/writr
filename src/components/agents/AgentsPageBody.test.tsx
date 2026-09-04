// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type {
  AgentDefinition,
  AgentDefinitionId,
  ProjectId,
} from "@/db/schemas";
import { AgentsPageBody } from "./AgentsPageBody";

const projectId = "00000000-0000-4000-8000-0000000000aa" as ProjectId;
const otherProjectId = "00000000-0000-4000-8000-0000000000bb" as ProjectId;
const ts = "2024-01-01T00:00:00.000Z";
const agentId1 = "00000000-0000-4000-8000-000000000001" as AgentDefinitionId;
const agentId2 = "00000000-0000-4000-8000-000000000002" as AgentDefinitionId;
const agentId3 = "00000000-0000-4000-8000-000000000003" as AgentDefinitionId;

function makeAgent(
  overrides: Partial<AgentDefinition> & {
    id: AgentDefinitionId;
    name: string;
  },
): AgentDefinition {
  return {
    kind: "user",
    projectId: null,
    description: "",
    systemPrompt: "You are a helpful assistant.",
    allowedToolIds: [],
    modelOverride: null,
    assistantPrefill: "",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  } as AgentDefinition;
}

describe("AgentsPageBody", () => {
  beforeEach(async () => {
    await db.agents.clear();
  });

  it("lists global and project agents with links to their editors", async () => {
    await db.agents.bulkAdd([
      makeAgent({
        id: agentId1,
        name: "Spark",
        kind: "spark",
        projectId: null,
      }),
      makeAgent({
        id: agentId2,
        name: "My Custom Agent",
        kind: "user",
        projectId,
      }),
      makeAgent({
        id: agentId3,
        name: "Someone Else's Agent",
        kind: "user",
        projectId: otherProjectId,
      }),
    ]);

    render(<AgentsPageBody projectId={projectId} />);

    await waitFor(() => expect(screen.getByText("Spark")).toBeTruthy());
    expect(screen.getByText("My Custom Agent")).toBeTruthy();
    expect(screen.queryByText("Someone Else's Agent")).toBeNull();

    const link = screen.getByText("My Custom Agent").closest("a");
    expect(link?.getAttribute("href")).toBe(
      `/projects/${projectId}/agents/definitions/${agentId2}`,
    );

    const newAgentLink = screen.getByText("New Agent").closest("a");
    expect(newAgentLink?.getAttribute("href")).toBe(
      `/projects/${projectId}/agents/definitions/new`,
    );
  });

  it("shows an empty state when there are no agents", async () => {
    render(<AgentsPageBody projectId={projectId} />);

    await waitFor(() =>
      expect(
        screen.getByText("No agents yet. Add one to get started."),
      ).toBeTruthy(),
    );
  });
});
