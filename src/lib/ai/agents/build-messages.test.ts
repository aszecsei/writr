import { describe, expect, it } from "vitest";
import type { AiContext, AiMessage } from "../types";
import {
  makeAgentBuildMessages,
  makeChatAgentBuildMessages,
} from "./build-messages";

function emptyContext(overrides?: Partial<AiContext>): AiContext {
  return {
    projectTitle: "Test Novel",
    projectDescription: "",
    genre: "",
    characters: [],
    locations: [],
    styleGuide: [],
    guardrails: [],
    timelineEvents: [],
    worldbuildingDocs: [],
    relationships: [],
    outlineGridColumns: [],
    outlineGridRows: [],
    outlineGridCells: [],
    chapters: [],
    ...overrides,
  };
}

describe("assembleAgentMessages (via makeAgentBuildMessages)", () => {
  describe("trailing-assistant invariant", () => {
    it("strips a trailing assistant message from initialMessages when no userInput / prefill", () => {
      const initialMessages: AiMessage[] = [
        { role: "user", content: "briefing" },
        { role: "assistant", content: "Understood." },
      ];
      const build = makeAgentBuildMessages({
        systemPrompt: "sys",
        context: emptyContext(),
        initialMessages,
        enableToolCalling: true,
      });

      const messages = build({ history: [] });

      // Anthropic via OpenRouter rejects messages that end with role:"assistant".
      expect(messages[messages.length - 1].role).not.toBe("assistant");
      // The user briefing must remain — only the trailing ack was stripped.
      expect(messages[messages.length - 1].role).toBe("user");
      const last = messages[messages.length - 1];
      const lastText =
        typeof last.content === "string"
          ? last.content
          : last.content.map((p) => (p.type === "text" ? p.text : "")).join("");
      expect(lastText).toBe("briefing");
    });

    it("strips a trailing assistant message from history", () => {
      const build = makeAgentBuildMessages({
        systemPrompt: "sys",
        context: emptyContext(),
        enableToolCalling: true,
      });

      const messages = build({
        history: [
          { role: "user", content: "kickoff" },
          { role: "assistant", content: "I think the answer is foo" },
        ],
      });

      expect(messages[messages.length - 1].role).not.toBe("assistant");
    });

    it("preserves an explicit assistantPrefill at the end", () => {
      const build = makeAgentBuildMessages({
        systemPrompt: "sys",
        context: emptyContext(),
        enableToolCalling: false,
        assistantPrefill: "{",
      });

      const messages = build({
        history: [{ role: "user", content: "go" }],
      });

      const last = messages[messages.length - 1];
      expect(last.role).toBe("assistant");
      expect(last.content).toBe("{");
    });

    it("emits the system prompt as a content-parts array with cache_control", () => {
      const build = makeAgentBuildMessages({
        systemPrompt: "you are a reader",
        context: emptyContext(),
        enableToolCalling: true,
      });

      const messages = build({ history: [] });

      const system = messages[0];
      expect(system.role).toBe("system");
      expect(system.content).toEqual([
        {
          type: "text",
          text: "you are a reader",
          cache_control: { type: "ephemeral" },
        },
      ]);
    });

    it("emits a user message at the tail when called with empty initialMessages and empty history", () => {
      const build = makeAgentBuildMessages({
        systemPrompt: "sys",
        context: emptyContext(),
        enableToolCalling: true,
      });

      const messages = build({ history: [] });

      // After removing the unconditional "Understood." ack, the cacheable
      // project-context user message is the tail.
      expect(messages[messages.length - 1].role).toBe("user");
    });
  });
});

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
