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
    it("passes apiKey to GoogleGenAI constructor", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: { parts: [{ text: "Hi!" }] },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      });

      await adapter.complete("AIzaTestKey", baseParams);

      expect(constructorCalls[0]).toEqual({ apiKey: "AIzaTestKey" });
    });

    it("extracts system messages into systemInstruction", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: { parts: [{ text: "Hi!" }] },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      });

      await adapter.complete("key", baseParams);

      const call = mockGenerateContent.mock.calls[0][0];
      expect(call.config.systemInstruction).toBe("You are helpful.");
      // System messages should not be in contents
      expect(call.contents).toEqual([
        { role: "user", parts: [{ text: "Hello" }] },
      ]);
    });

    it("maps assistant role to model role", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: { parts: [{ text: "ok" }] },
            finishReason: "STOP",
          },
        ],
      });

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
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: { parts: [{ text: "I see an image" }] },
            finishReason: "STOP",
          },
        ],
      });

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
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: { parts: [{ text: "ok" }] },
            finishReason: "STOP",
          },
        ],
      });

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
      mockGenerateContent.mockResolvedValueOnce({
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
      });

      const result = await adapter.complete("key", {
        ...baseParams,
        reasoning: { effort: "high" },
      });

      expect(result.reasoning).toBe("I need to think...");
      expect(result.content).toBe("The answer is 42");
    });

    it("maps response to AiResponse", async () => {
      mockGenerateContent.mockResolvedValueOnce({
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
      });

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

    it("normalizes finish reasons correctly", async () => {
      for (const [raw, expected] of [
        ["STOP", "stop"],
        ["MAX_TOKENS", "length"],
        ["SAFETY", "content_filter"],
        ["BLOCKLIST", "content_filter"],
        ["OTHER", "unknown"],
        [undefined, "stop"],
      ] as const) {
        mockGenerateContent.mockResolvedValueOnce({
          candidates: [
            {
              content: { parts: [{ text: "ok" }] },
              finishReason: raw,
            },
          ],
        });

        const result = await adapter.complete("key", baseParams);
        expect(result.finishReason).toBe(expected);
      }
    });

    it("passes thinkingConfig when reasoning effort is set", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: { parts: [{ text: "ok" }] },
            finishReason: "STOP",
          },
        ],
      });

      await adapter.complete("key", {
        ...baseParams,
        reasoning: { effort: "high" },
      });

      const call = mockGenerateContent.mock.calls[0][0];
      expect(call.config.thinkingConfig).toEqual({
        thinkingBudget: 24576,
      });
    });

    it("omits thinkingConfig when reasoning effort is none", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: { parts: [{ text: "ok" }] },
            finishReason: "STOP",
          },
        ],
      });

      await adapter.complete("key", {
        ...baseParams,
        reasoning: { effort: "none" },
      });

      const call = mockGenerateContent.mock.calls[0][0];
      expect(call.config.thinkingConfig).toBeUndefined();
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
  });

  describe("vertex mode", () => {
    const vertexAdapter = createGoogleAdapter({ mode: "vertex" });

    it("parses project:location from apiKey", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: { parts: [{ text: "ok" }] },
            finishReason: "STOP",
          },
        ],
      });

      await vertexAdapter.complete("my-project:us-east1", baseParams);

      expect(constructorCalls[0]).toEqual({
        vertexai: true,
        project: "my-project",
        location: "us-east1",
      });
    });

    it("defaults location to us-central1 when missing", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: { parts: [{ text: "ok" }] },
            finishReason: "STOP",
          },
        ],
      });

      await vertexAdapter.complete("my-project", baseParams);

      expect(constructorCalls[0]).toEqual({
        vertexai: true,
        project: "my-project",
        location: "us-central1",
      });
    });
  });
});
