import { describe, expect, it } from "vitest";
import type { ProjectId } from "@/db/schemas";
import { AI_TOOL_MAP, AI_TOOLS, executeTool } from "./tools";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const ctx = { projectId };

describe("tool registry", () => {
  it("has unique tool IDs", () => {
    const ids = AI_TOOLS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("executeTool with unknown tool", () => {
  it("returns failure for unknown tool ID", async () => {
    const result = await executeTool("nonexistent_tool", {}, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Unknown tool");
  });
});

describe("requiresApproval", () => {
  // A handful of tools auto-execute without a separate approval step even
  // though they mutate or gate on user interaction: comments and proposed
  // edits are staged for the user to review, and orchestration tools aren't
  // data mutations at all.
  const autoExecuteExceptions = new Set([
    "add_comment",
    "reply_to_comment",
    "propose_edit",
    "delegate",
    "present_choice",
  ]);

  it("is predicted by the id prefix (list/get/read_/search_ ⇒ no approval) for every other tool", () => {
    for (const tool of AI_TOOLS) {
      if (autoExecuteExceptions.has(tool.id)) continue;
      const isReadIsh = /^(list|get|read_|search_)/.test(tool.id);
      expect(AI_TOOL_MAP.get(tool.id)?.requiresApproval).toBe(!isReadIsh);
    }
  });
});
