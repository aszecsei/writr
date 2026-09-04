import { describe, expect, it } from "vitest";
import type { ProjectId } from "@/db/schemas";
import { executeTool } from "../tools";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const ctx = { projectId };

describe("delegate tool (without a delegation host)", () => {
  it("fails when context.delegation is absent (e.g. pipeline run)", async () => {
    const result = await executeTool(
      "delegate",
      { agent: "Reader", prompt: "Summarize chapter one." },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/only available in interactive chat/i);
  });

  it("requires a non-empty agent and prompt", async () => {
    const result = await executeTool(
      "delegate",
      { agent: "", prompt: "" },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
  });
});
