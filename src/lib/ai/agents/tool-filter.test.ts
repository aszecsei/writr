import { describe, expect, it } from "vitest";
import { executeAgentTool, getToolDefinitionsForAgent } from "./tool-filter";
import type { Agent } from "./types";

const projectId = "a1111111-1111-4111-a111-111111111111";

function makeAgent(allowed: string[] | undefined): Agent {
  return {
    id: "test-agent",
    kind: "custom",
    enableToolCalling: true,
    allowedToolIds: allowed,
    buildMessages: () => [],
    agentContext: { projectId },
  };
}

describe("getToolDefinitionsForAgent — list/get scoping", () => {
  it("omits list and get entirely when no list:* / get:* permission is set", () => {
    const defs = getToolDefinitionsForAgent(makeAgent(["read_chapter"]));
    const ids = defs?.map((d) => d.id) ?? [];
    expect(ids).not.toContain("list");
    expect(ids).not.toContain("get");
    expect(ids).toContain("read_chapter");
  });

  it("surfaces unscoped tools intact when allowedToolIds includes the bare verb", () => {
    const defs = getToolDefinitionsForAgent(makeAgent(["list", "get"]));
    const list = defs?.find((d) => d.id === "list");
    const get = defs?.find((d) => d.id === "get");
    expect(list).toBeDefined();
    expect(get).toBeDefined();
    // Unscoped → enums NOT narrowed (still include all categories).
    expect(list?.parameters.properties.category?.enum).toContain("character");
    expect(list?.parameters.properties.category?.enum).toContain(
      "worldbuilding",
    );
  });

  it("narrows list's category enum to scoped categories", () => {
    const defs = getToolDefinitionsForAgent(
      makeAgent(["list:chapter", "list:character"]),
    );
    const list = defs?.find((d) => d.id === "list");
    expect(list).toBeDefined();
    expect(list?.parameters.properties.category?.enum?.sort()).toEqual([
      "chapter",
      "character",
    ]);
  });

  it("narrows get's nested requests[].category enum to scoped categories", () => {
    const defs = getToolDefinitionsForAgent(
      makeAgent(["get:summary", "get:outline"]),
    );
    const get = defs?.find((d) => d.id === "get");
    const reqsItems = get?.parameters.properties.requests?.items;
    expect(reqsItems?.properties?.category?.enum?.sort()).toEqual([
      "outline",
      "summary",
    ]);
  });

  it("returns all tools when allowedToolIds is undefined", () => {
    const defs = getToolDefinitionsForAgent(makeAgent(undefined));
    const ids = defs?.map((d) => d.id) ?? [];
    expect(ids).toContain("list");
    expect(ids).toContain("get");
    expect(ids).toContain("read_chapter");
  });

  it("returns undefined when enableToolCalling is false", () => {
    const agent: Agent = { ...makeAgent(["list"]), enableToolCalling: false };
    expect(getToolDefinitionsForAgent(agent)).toBeUndefined();
  });
});

describe("executeAgentTool — list/get scoping", () => {
  it("rejects list with a category outside the agent's scoped permissions", async () => {
    const agent = makeAgent(["list:chapter"]);
    const r = await executeAgentTool(agent, "list", { category: "character" });
    expect(r.success).toBe(false);
    expect(r.message).toContain("not permitted");
  });

  it("rejects get when any request's category is outside scope", async () => {
    const agent = makeAgent(["get:summary"]);
    const r = await executeAgentTool(agent, "get", {
      requests: [
        { category: "summary", ids: ["x"] },
        { category: "character", ids: ["y"] },
      ],
    });
    expect(r.success).toBe(false);
    expect(r.message).toContain("not permitted");
  });

  it("rejects list when no list:* / list permission is set", async () => {
    const agent = makeAgent(["read_chapter"]);
    const r = await executeAgentTool(agent, "list", { category: "chapter" });
    expect(r.success).toBe(false);
    expect(r.message).toContain("not permitted");
  });

  it("rejects unrelated tool calls outside the agent's allowedToolIds", async () => {
    const agent = makeAgent(["list:chapter"]);
    const r = await executeAgentTool(agent, "create_character", {
      name: "X",
    });
    expect(r.success).toBe(false);
    expect(r.message).toContain("not permitted");
  });
});
