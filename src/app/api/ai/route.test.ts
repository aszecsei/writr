import { describe, expect, it } from "vitest";
import type { ProjectId } from "@/db/schemas";
import { getToolDefinitionsForAgent } from "@/lib/ai/agents/tool-filter";
import type { Agent } from "@/lib/ai/agents/types";
import { AI_TOOL_MAP } from "@/lib/ai/tool-calling";
import { ToolDefinitionSchema } from "./request-schema";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;

function makeAgent(allowed: string[] | undefined): Agent {
  return {
    kind: "custom",
    enableToolCalling: true,
    allowedToolIds: allowed,
    buildMessages: () => [],
    agentContext: { projectId },
  };
}

describe("ToolDefinitionSchema", () => {
  it("round-trips the get tool's nested items/properties schema", () => {
    const tool = AI_TOOL_MAP.get("get");
    if (!tool) throw new Error("get tool not registered");
    const input = {
      id: tool.id,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    };

    const parsed = ToolDefinitionSchema.parse(input);

    expect(parsed).toEqual(input);
  });

  it("preserves the narrowed get requests[].category enum inside items", () => {
    const defs = getToolDefinitionsForAgent(
      makeAgent(["get:summary", "get:outline"]),
    );
    const get = defs?.find((d) => d.id === "get");
    if (!get) throw new Error("get tool not surfaced for scoped agent");

    const parsed = ToolDefinitionSchema.parse(get);

    expect(
      parsed.parameters.properties.requests?.items?.properties?.category?.enum,
    ).toEqual(["outline", "summary"]);
    expect(parsed).toEqual(get);
  });
});
