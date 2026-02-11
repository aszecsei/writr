import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiMessage } from "../types";
import type { CompletionParams } from "./types";

// Mock the openai module
const mockCreate = vi.fn();
const constructorCalls: Record<string, unknown>[] = [];

vi.mock("openai", () => {
  class MockOpenAI {
    chat = { completions: { create: mockCreate } };
    constructor(config: Record<string, unknown>) {
      constructorCalls.push(config);
    }
  }
  return { default: MockOpenAI };
});

import { createOpenAiAdapter } from "./openai-adapter";

describe("createOpenAiAdapter", () => {
  const adapter = createOpenAiAdapter({
    baseURL: "https://test.api.com/v1",
    defaultHeaders: { "X-Custom": "header" },
  });

  beforeEach(() => {
    mockCreate.mockReset();
  });

  const baseParams: CompletionParams = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
    ],
    temperature: 0.7,
    maxTokens: 2048,
  };

  describe("complete", () => {
    it("passes correct config to OpenAI constructor", async () => {
      constructorCalls.length = 0;
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: "assistant", content: "Hi!" },
            finish_reason: "stop",
          },
        ],
        model: "gpt-4o",
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      });

      await adapter.complete("sk-test-key", baseParams);

      expect(constructorCalls[constructorCalls.length - 1]).toEqual({
        apiKey: "sk-test-key",
        baseURL: "https://test.api.com/v1",
        defaultHeaders: { "X-Custom": "header" },
      });
    });

    it("maps response to AiResponse", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: "assistant", content: "Hello there!" },
            finish_reason: "stop",
          },
        ],
        model: "gpt-4o-2024",
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      });

      const result = await adapter.complete("sk-test", baseParams);

      expect(result).toEqual({
        content: "Hello there!",
        reasoning: undefined,
        model: "gpt-4o-2024",
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
        finishReason: "stop",
      });
    });

    it("includes reasoning when present", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: "Result",
              reasoning: "I thought about it",
            },
            finish_reason: "stop",
          },
        ],
        model: "o1",
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      });

      const result = await adapter.complete("sk-test", {
        ...baseParams,
        reasoning: { effort: "high" },
      });

      expect(result.reasoning).toBe("I thought about it");
    });

    it("strips cache_control from messages", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        model: "gpt-4o",
      });

      const messages: AiMessage[] = [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: "system prompt",
              cache_control: { type: "ephemeral" },
            },
          ],
        },
        { role: "user", content: "hello" },
      ];

      await adapter.complete("sk-test", { ...baseParams, messages });

      const createCall = mockCreate.mock.calls[0][0];
      const systemMsg = createCall.messages[0];
      // cache_control should be stripped
      expect(systemMsg.content[0]).toEqual({
        type: "text",
        text: "system prompt",
      });
      expect(systemMsg.content[0].cache_control).toBeUndefined();
    });

    it("passes reasoning parameter when provided", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        model: "o1",
      });

      await adapter.complete("sk-test", {
        ...baseParams,
        reasoning: { effort: "high" },
      });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.reasoning).toEqual({ effort: "high" });
    });

    it("normalizes finish_reason correctly", async () => {
      for (const [raw, expected] of [
        ["stop", "stop"],
        ["length", "length"],
        ["content_filter", "content_filter"],
        ["other", "unknown"],
        [null, "stop"],
      ] as const) {
        mockCreate.mockResolvedValueOnce({
          choices: [
            {
              message: { role: "assistant", content: "ok" },
              finish_reason: raw,
            },
          ],
          model: "gpt-4o",
        });

        const result = await adapter.complete("sk-test", baseParams);
        expect(result.finishReason).toBe(expected);
      }
    });
  });

  describe("stream", () => {
    it("yields content chunks", async () => {
      const chunks = [
        { choices: [{ delta: { content: "Hello" }, finish_reason: null }] },
        { choices: [{ delta: { content: " world" }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ];

      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) yield chunk;
        },
      });

      const results: unknown[] = [];
      for await (const chunk of adapter.stream("sk-test", baseParams)) {
        results.push(chunk);
      }

      expect(results).toEqual([
        { type: "content", text: "Hello" },
        { type: "content", text: " world" },
        { type: "stop", finishReason: "stop" },
      ]);
    });

    it("yields reasoning chunks from reasoning_details", async () => {
      const chunks = [
        {
          choices: [
            {
              delta: {
                reasoning_details: [{ text: "thinking..." }],
              },
              finish_reason: null,
            },
          ],
        },
        { choices: [{ delta: { content: "Result" }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ];

      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) yield chunk;
        },
      });

      const results: unknown[] = [];
      for await (const chunk of adapter.stream("sk-test", baseParams)) {
        results.push(chunk);
      }

      expect(results).toEqual([
        { type: "reasoning", text: "thinking..." },
        { type: "content", text: "Result" },
        { type: "stop", finishReason: "stop" },
      ]);
    });

    it("yields reasoning chunks from direct reasoning field", async () => {
      const chunks = [
        {
          choices: [
            {
              delta: { reasoning: "I think..." },
              finish_reason: null,
            },
          ],
        },
        { choices: [{ delta: { content: "Answer" }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ];

      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) yield chunk;
        },
      });

      const results: unknown[] = [];
      for await (const chunk of adapter.stream("sk-test", baseParams)) {
        results.push(chunk);
      }

      expect(results[0]).toEqual({ type: "reasoning", text: "I think..." });
    });
  });
});
