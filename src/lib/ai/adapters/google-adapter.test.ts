import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiMessage } from "../types";
import type { CompletionParams } from "./types";

// Mock the @google/genai module
const mockGenerateContent = vi.fn();
const mockGenerateContentStream = vi.fn();
const constructorCalls: Record<string, unknown>[] = [];

vi.mock("@google/genai", () => {
  class MockGoogleGenAI {
    models = {
      generateContent: mockGenerateContent,
      generateContentStream: mockGenerateContentStream,
    };
    constructor(config: Record<string, unknown>) {
      constructorCalls.push(config);
    }
  }
  return { GoogleGenAI: MockGoogleGenAI };
});

import { createGoogleAdapter } from "./google-adapter";

function okResponse(overrides: Record<string, unknown> = {}) {
  return {
    candidates: [
      {
        content: { parts: [{ text: "ok" }] },
        finishReason: "STOP",
      },
    ],
    ...overrides,
  };
}

describe("createGoogleAdapter", () => {
  const adapter = createGoogleAdapter({ mode: "api-key" });

  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockGenerateContentStream.mockReset();
    constructorCalls.length = 0;
  });

  const baseParams: CompletionParams = {
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
    ],
    temperature: 0.7,
    maxTokens: 2048,
  };

  describe("complete", () => {
    it("extracts system messages into systemInstruction", async () => {
      mockGenerateContent.mockResolvedValueOnce(okResponse());

      await adapter.complete("key", baseParams);

      const call = mockGenerateContent.mock.calls[0][0];
      expect(call.config.systemInstruction).toBe("You are helpful.");
      // System messages should not be in contents
      expect(call.contents).toEqual([
        { role: "user", parts: [{ text: "Hello" }] },
      ]);
    });

    it("maps assistant role to model role", async () => {
      mockGenerateContent.mockResolvedValueOnce(okResponse());

      const messages: AiMessage[] = [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
        { role: "user", content: "How are you?" },
      ];

      await adapter.complete("key", { ...baseParams, messages });

      const call = mockGenerateContent.mock.calls[0][0];
      expect(call.contents[0].role).toBe("user");
      expect(call.contents[1].role).toBe("model");
      expect(call.contents[2].role).toBe("user");
    });

    it("converts base64 data URL images to inlineData", async () => {
      mockGenerateContent.mockResolvedValueOnce(okResponse());

      const messages: AiMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this?" },
            {
              type: "image_url",
              image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
            },
          ],
        },
      ];

      await adapter.complete("key", { ...baseParams, messages });

      const call = mockGenerateContent.mock.calls[0][0];
      expect(call.contents[0].parts).toEqual([
        { text: "What is this?" },
        { inlineData: { mimeType: "image/png", data: "iVBORw0KGgo=" } },
      ]);
    });

    it("converts non-data-URL images to text placeholder", async () => {
      mockGenerateContent.mockResolvedValueOnce(okResponse());

      const messages: AiMessage[] = [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: "https://example.com/image.png" },
            },
          ],
        },
      ];

      await adapter.complete("key", { ...baseParams, messages });

      const call = mockGenerateContent.mock.calls[0][0];
      expect(call.contents[0].parts).toEqual([
        { text: "[Image: https://example.com/image.png]" },
      ]);
    });

    it("extracts reasoning from thought parts", async () => {
      mockGenerateContent.mockResolvedValueOnce(
        okResponse({
          candidates: [
            {
              content: {
                parts: [
                  { text: "I need to think...", thought: true },
                  { text: "The answer is 42" },
                ],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        }),
      );

      const result = await adapter.complete("key", {
        ...baseParams,
        reasoning: { effort: "high" },
      });

      expect(result.reasoning).toBe("I need to think...");
      expect(result.content).toBe("The answer is 42");
    });

    it("maps response to AiResponse", async () => {
      mockGenerateContent.mockResolvedValueOnce(
        okResponse({
          candidates: [
            {
              content: { parts: [{ text: "Hello there!" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        }),
      );

      const result = await adapter.complete("key", baseParams);

      expect(result).toEqual({
        content: "Hello there!",
        reasoning: undefined,
        model: "gemini-2.5-flash",
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
        finishReason: "stop",
      });
    });

    it.each([
      ["STOP", "stop"],
      ["MAX_TOKENS", "length"],
      ["SAFETY", "content_filter"],
      ["BLOCKLIST", "content_filter"],
      ["OTHER", "unknown"],
      [undefined, "stop"],
    ] as const)("normalizes finish reason %s to %s", async (raw, expected) => {
      mockGenerateContent.mockResolvedValueOnce(
        okResponse({
          candidates: [
            {
              content: { parts: [{ text: "ok" }] },
              finishReason: raw,
            },
          ],
        }),
      );

      const result = await adapter.complete("key", baseParams);
      expect(result.finishReason).toBe(expected);
    });

    it("passes thinkingConfig when reasoning effort is set, omits it when effort is none", async () => {
      mockGenerateContent.mockResolvedValueOnce(okResponse());
      await adapter.complete("key", {
        ...baseParams,
        reasoning: { effort: "high" },
      });
      expect(
        mockGenerateContent.mock.calls[0][0].config.thinkingConfig,
      ).toEqual({ thinkingBudget: 24576 });

      mockGenerateContent.mockResolvedValueOnce(okResponse());
      await adapter.complete("key", {
        ...baseParams,
        reasoning: { effort: "none" },
      });
      expect(
        mockGenerateContent.mock.calls[1][0].config.thinkingConfig,
      ).toBeUndefined();
    });

    it("preserves tool message content when wrapped in a cache_control text part", async () => {
      // `withTrailingCacheControl` wraps the most recent tool result into a
      // TextContentPart array; the tool branch must not collapse it to `"{}"`
      // via `typeof content === "string" ? content : "{}"`, or the model sees
      // an empty function response.
      mockGenerateContent.mockResolvedValueOnce(okResponse());

      const messages: AiMessage[] = [
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_1", name: "list", arguments: {} }],
        },
        {
          role: "tool",
          toolCallId: "call_1",
          content: [
            {
              type: "text",
              text: '{"success":true,"chapters":["one"]}',
              cache_control: { type: "ephemeral" },
            },
          ],
        },
      ];

      await adapter.complete("key", { ...baseParams, messages });

      const call = mockGenerateContent.mock.calls[0][0];
      const toolMsg = call.contents[1];
      expect(toolMsg).toEqual({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: "list",
              response: { success: true, chapters: ["one"] },
            },
          },
        ],
      });
    });

    it("resolves functionResponse.name from the matching tool call id, not the toolCallId string itself", async () => {
      mockGenerateContent.mockResolvedValueOnce(okResponse());

      const messages: AiMessage[] = [
        {
          role: "assistant",
          content: "",
          toolCalls: [
            { id: "call_abc123", name: "create_character", arguments: {} },
          ],
        },
        {
          role: "tool",
          toolCallId: "call_abc123",
          content: '{"success":true}',
        },
      ];

      await adapter.complete("key", { ...baseParams, messages });

      const call = mockGenerateContent.mock.calls[0][0];
      expect(call.contents[1].parts[0].functionResponse.name).toBe(
        "create_character",
      );
    });

    it("wraps non-JSON tool result text as { result: text } instead of throwing", async () => {
      mockGenerateContent.mockResolvedValueOnce(okResponse());

      const messages: AiMessage[] = [
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_1", name: "search", arguments: {} }],
        },
        {
          role: "tool",
          toolCallId: "call_1",
          content: "not valid json",
        },
      ];

      await adapter.complete("key", { ...baseParams, messages });

      const call = mockGenerateContent.mock.calls[0][0];
      expect(call.contents[1].parts[0].functionResponse).toEqual({
        name: "search",
        response: { result: "not valid json" },
      });
    });
  });

  describe("stream", () => {
    it("yields content chunks", async () => {
      const responses = [
        {
          candidates: [{ content: { parts: [{ text: "Hello" }] } }],
        },
        {
          candidates: [{ content: { parts: [{ text: " world" }] } }],
        },
        {
          candidates: [
            {
              content: { parts: [{ text: "!" }] },
              finishReason: "STOP",
            },
          ],
        },
      ];

      mockGenerateContentStream.mockResolvedValueOnce(
        (async function* () {
          for (const r of responses) yield r;
        })(),
      );

      const results: unknown[] = [];
      for await (const chunk of adapter.stream("key", baseParams)) {
        results.push(chunk);
      }

      expect(results).toEqual([
        { type: "content", text: "Hello" },
        { type: "content", text: " world" },
        { type: "content", text: "!" },
        { type: "stop", finishReason: "stop" },
      ]);
    });

    it("yields reasoning chunks from thought parts", async () => {
      const responses = [
        {
          candidates: [
            {
              content: {
                parts: [{ text: "thinking...", thought: true }],
              },
            },
          ],
        },
        {
          candidates: [
            {
              content: { parts: [{ text: "Result" }] },
              finishReason: "STOP",
            },
          ],
        },
      ];

      mockGenerateContentStream.mockResolvedValueOnce(
        (async function* () {
          for (const r of responses) yield r;
        })(),
      );

      const results: unknown[] = [];
      for await (const chunk of adapter.stream("key", baseParams)) {
        results.push(chunk);
      }

      expect(results).toEqual([
        { type: "reasoning", text: "thinking..." },
        { type: "content", text: "Result" },
        { type: "stop", finishReason: "stop" },
      ]);
    });

    it("attaches the final usageMetadata to the stop chunk", async () => {
      const responses = [
        {
          candidates: [{ content: { parts: [{ text: "Hello" }] } }],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 5,
            totalTokenCount: 105,
          },
        },
        {
          candidates: [
            {
              content: { parts: [{ text: " world" }] },
              finishReason: "STOP",
            },
          ],
          // Final chunk carries the run-final running totals.
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 12,
            totalTokenCount: 112,
          },
        },
      ];

      mockGenerateContentStream.mockResolvedValueOnce(
        (async function* () {
          for (const r of responses) yield r;
        })(),
      );

      const results: unknown[] = [];
      for await (const chunk of adapter.stream("key", baseParams)) {
        results.push(chunk);
      }

      expect(results.at(-1)).toEqual({
        type: "stop",
        finishReason: "stop",
        usage: {
          prompt_tokens: 100,
          completion_tokens: 12,
          total_tokens: 112,
        },
      });
    });
  });

  describe("vertex mode", () => {
    const vertexAdapter = createGoogleAdapter({ mode: "vertex" });

    it("parses project:location from apiKey, defaulting location to us-central1 when missing", async () => {
      mockGenerateContent.mockResolvedValueOnce(okResponse());
      await vertexAdapter.complete("my-project:us-east1", baseParams);
      expect(constructorCalls[0]).toEqual({
        vertexai: true,
        project: "my-project",
        location: "us-east1",
      });

      mockGenerateContent.mockResolvedValueOnce(okResponse());
      await vertexAdapter.complete("my-project", baseParams);
      expect(constructorCalls[1]).toEqual({
        vertexai: true,
        project: "my-project",
        location: "us-central1",
      });
    });
  });
});
