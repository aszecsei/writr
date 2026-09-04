import { describe, expect, it } from "vitest";
import { AI_TOOL_MAP } from "@/lib/ai/tool-calling/tools";
import { BUILTIN_AGENT_DEFAULTS } from "./builtins/defaults";

describe("BUILTIN_AGENT_DEFAULTS", () => {
  it("every builtin's allowedToolIds resolve to registered tools", () => {
    for (const [kind, def] of Object.entries(BUILTIN_AGENT_DEFAULTS)) {
      for (const id of def.allowedToolIds) {
        // Scoped read ids (e.g. "list:character") map to the consolidated
        // list/get tools; everything else must be a registered tool id.
        const base = id.includes(":") ? id.split(":")[0] : id;
        expect(
          AI_TOOL_MAP.get(base),
          `${kind}: unknown tool id "${id}"`,
        ).toBeDefined();
      }
    }
  });
});
