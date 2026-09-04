import { describe, expect, it } from "vitest";
import type { AiContext } from "../types";
import { makeChatAgentBuildMessages } from "./build-messages";

function emptyContext(overrides?: Partial<AiContext>): AiContext {
  return {
    projectTitle: "Test Novel",
    projectDescription: "",
    genre: "",
    styleGuide: [],
    guardrails: [],
    chapters: [],
    ...overrides,
  };
}

describe("makeChatAgentBuildMessages", () => {
  it("forwards history through prompts.ts/buildMessages", () => {
    const build = makeChatAgentBuildMessages({
      systemPrompt: "chat-sys",
      context: emptyContext(),
    });

    const messages = build({
      history: [{ role: "user", content: "hello" }],
    });

    expect(messages[messages.length - 1].role).toBe("user");
    expect(messages[messages.length - 1].content).toBe("hello");
  });

  it("appends an assistantPrefill at the end when configured", () => {
    const build = makeChatAgentBuildMessages({
      systemPrompt: "chat-sys",
      context: emptyContext(),
      assistantPrefill: "{",
    });

    const messages = build({
      history: [{ role: "user", content: "go" }],
    });

    const last = messages[messages.length - 1];
    expect(last.role).toBe("assistant");
    expect(last.content).toBe("{");
  });
});
