import { describe, expect, it } from "vitest";
import type { AiContext, AiMessage } from "../types";
import { makeAgentBuildMessages } from "./build-messages";

function emptyContext(overrides?: Partial<AiContext>): AiContext {
  return {
    projectTitle: "Test Novel",
    projectDescription: "",
    genre: "",
    characters: [],
    locations: [],
    styleGuide: [],
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

      const messages = build({
        history: [],
        userInput: undefined,
        skipUserPrompt: undefined,
      });

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

    it("strips a trailing assistant message from history when no userInput", () => {
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
        userInput: undefined,
        skipUserPrompt: undefined,
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
        history: [],
        userInput: "go",
        skipUserPrompt: undefined,
      });

      const last = messages[messages.length - 1];
      expect(last.role).toBe("assistant");
      expect(last.content).toBe("{");
    });

    it("places the userInput after initialMessages so the array ends with user", () => {
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

      const messages = build({
        history: [],
        userInput: "now begin",
        skipUserPrompt: undefined,
      });

      const last = messages[messages.length - 1];
      expect(last.role).toBe("user");
      expect(last.content).toBe("now begin");
      // The priming assistant ack should still be present (not at the tail).
      const hasUnderstood = messages.some(
        (m) => m.role === "assistant" && m.content === "Understood.",
      );
      expect(hasUnderstood).toBe(true);
    });

    it("emits the system prompt as a content-parts array with cache_control", () => {
      const build = makeAgentBuildMessages({
        systemPrompt: "you are a reader",
        context: emptyContext(),
        enableToolCalling: true,
      });

      const messages = build({
        history: [],
        userInput: undefined,
        skipUserPrompt: undefined,
      });

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

    it("emits a final user message when called with empty initialMessages and no userInput", () => {
      const build = makeAgentBuildMessages({
        systemPrompt: "sys",
        context: emptyContext(),
        enableToolCalling: true,
      });

      const messages = build({
        history: [],
        userInput: undefined,
        skipUserPrompt: undefined,
      });

      // After removing the unconditional "Understood." ack, the cacheable
      // project-context user message is the tail.
      expect(messages[messages.length - 1].role).toBe("user");
    });
  });
});
