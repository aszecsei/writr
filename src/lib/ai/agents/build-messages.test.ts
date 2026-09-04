import { describe, expect, it } from "vitest";
import { makeAiContext } from "@/test/helpers";
import { makeChatAgentBuildMessages } from "./build-messages";

describe("makeChatAgentBuildMessages", () => {
  it("forwards history through prompts.ts/buildMessages", () => {
    const build = makeChatAgentBuildMessages({
      systemPrompt: "chat-sys",
      context: makeAiContext(),
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
      context: makeAiContext(),
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
