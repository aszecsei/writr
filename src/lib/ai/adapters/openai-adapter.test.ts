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

    it("preserves tool message content when wrapped in a cache_control text part", async () => {
      // Regression: `withTrailingCacheControl` wraps the most recent tool
      // result into a TextContentPart array. Previously the tool branch
      // checked `typeof content === "string"` and dropped the array, sending
      // empty content for the tool result.
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
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_1", name: "list_chapters", arguments: {} }],
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

      await adapter.complete("sk-test", { ...baseParams, messages });

      const createCall = mockCreate.mock.calls[0][0];
      const toolMsg = createCall.messages[1];
      expect(toolMsg.role).toBe("tool");
      expect(toolMsg.tool_call_id).toBe("call_1");
      expect(toolMsg.content).toBe('{"success":true,"chapters":["one"]}');
    });

    it("preserves cache_control on tool messages for Anthropic-via-OpenRouter models", async () => {
      // For OpenRouter routing to Anthropic, cache_control on tool result
      // messages must survive the conversion. Without this the trailing
      // breakpoint set by withTrailingCacheControl is dropped on every
      // tool-calling iteration, busting the prompt cache.
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        model: "anthropic/claude-sonnet-4-5",
      });

      const messages: AiMessage[] = [
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_1", name: "list_chapters", arguments: {} }],
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

      await adapter.complete("sk-test", {
        ...baseParams,
        model: "anthropic/claude-sonnet-4-5",
        messages,
      });

      const createCall = mockCreate.mock.calls[0][0];
      const toolMsg = createCall.messages[1];
      expect(toolMsg.role).toBe("tool");
      expect(toolMsg.tool_call_id).toBe("call_1");
      expect(toolMsg.content).toEqual([
        {
          type: "text",
          text: '{"success":true,"chapters":["one"]}',
          cache_control: { type: "ephemeral" },
        },
      ]);
    });

    it("sends tool messages as plain string when no cache_control attached (Anthropic route)", async () => {
      // Without cache_control, fall back to the simpler string form so we
      // don't pay the array-content overhead on every tool message.
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        model: "anthropic/claude-sonnet-4-5",
      });

      const messages: AiMessage[] = [
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_1", name: "list_chapters", arguments: {} }],
        },
        {
          role: "tool",
          toolCallId: "call_1",
          content: '{"success":true,"chapters":["one"]}',
        },
      ];

      await adapter.complete("sk-test", {
        ...baseParams,
        model: "anthropic/claude-sonnet-4-5",
        messages,
      });

      const createCall = mockCreate.mock.calls[0][0];
      const toolMsg = createCall.messages[1];
      expect(toolMsg.content).toBe('{"success":true,"chapters":["one"]}');
    });

    it("attaches cache_control to last tool entry only for Anthropic models", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        model: "anthropic/claude-sonnet-4-5",
      });

      await adapter.complete("sk-test", {
        ...baseParams,
        model: "anthropic/claude-sonnet-4-5",
        tools: [
          {
            id: "a",
            name: "a",
            description: "A",
            parameters: { type: "object", properties: {} },
          },
          {
            id: "b",
            name: "b",
            description: "B",
            parameters: { type: "object", properties: {} },
          },
        ],
      });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.tools).toHaveLength(2);
      expect(createCall.tools[0].cache_control).toBeUndefined();
      expect(createCall.tools[1].cache_control).toEqual({ type: "ephemeral" });
    });

    it("does not attach cache_control to tools for non-Anthropic models", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        model: "gpt-4o",
      });

      await adapter.complete("sk-test", {
        ...baseParams,
        tools: [
          {
            id: "a",
            name: "a",
            description: "A",
            parameters: { type: "object", properties: {} },
          },
        ],
      });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.tools[0].cache_control).toBeUndefined();
    });

    it("surfaces OpenRouter cache stats on usage", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        model: "anthropic/claude-sonnet-4-5",
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 50,
          total_tokens: 1050,
          prompt_tokens_details: { cached_tokens: 800 },
          cache_write_tokens: 200,
        },
      });

      const result = await adapter.complete("sk-test", {
        ...baseParams,
        model: "anthropic/claude-sonnet-4-5",
      });

      expect(result.usage).toEqual({
        prompt_tokens: 1000,
        completion_tokens: 50,
        total_tokens: 1050,
        cache_creation_tokens: 200,
        cache_read_tokens: 800,
      });
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

    it("requests usage stats via stream_options.include_usage", async () => {
      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: {}, finish_reason: "stop" }] };
        },
      });

      const consumed: unknown[] = [];
      for await (const chunk of adapter.stream("sk-test", baseParams)) {
        consumed.push(chunk);
      }

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.stream).toBe(true);
      expect(createCall.stream_options).toEqual({ include_usage: true });
    });

    it("attaches usage from final stream chunk to the stop event", async () => {
      const chunks = [
        { choices: [{ delta: { content: "Hi" }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
        // OpenAI emits a final usage-only chunk (empty choices) after the
        // finish_reason chunk when stream_options.include_usage is set.
        {
          choices: [],
          usage: {
            prompt_tokens: 42,
            completion_tokens: 7,
            total_tokens: 49,
          },
        },
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

      expect(results.at(-1)).toEqual({
        type: "stop",
        finishReason: "stop",
        usage: {
          prompt_tokens: 42,
          completion_tokens: 7,
          total_tokens: 49,
        },
      });
    });

    it("omits usage on stop when upstream did not provide it", async () => {
      const chunks = [
        { choices: [{ delta: { content: "Hi" }, finish_reason: null }] },
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

      expect(results.at(-1)).toEqual({ type: "stop", finishReason: "stop" });
    });

    it("does not request usage stats on non-streaming completions", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        model: "gpt-4o",
      });

      await adapter.complete("sk-test", baseParams);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.stream).toBe(false);
      expect(createCall.stream_options).toBeUndefined();
    });
  });
});
