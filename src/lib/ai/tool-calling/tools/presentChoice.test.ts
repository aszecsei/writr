import { describe, expect, it } from "vitest";
import type { ProjectId } from "@/db/schemas";
import { executeTool } from "../tools";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const ctx = { projectId };

describe("present_choice tool (without a delegation host)", () => {
  it("fails when context.delegation is absent", async () => {
    const result = await executeTool(
      "present_choice",
      { question: "Which ending?", options: ["A", "B"] },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/only available in interactive chat/i);
  });

  it("requires at least two options", async () => {
    const result = await executeTool(
      "present_choice",
      { question: "Pick", options: ["only one"] },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
  });
});
