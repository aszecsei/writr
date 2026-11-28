import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolDefinitionForModel } from "../tool-calling";
import type { AiMessage } from "../types";
import type { CompletionParams } from "./types";

// Mock the openai module
const mockCreate = vi.fn();

vi.mock("openai", () => {
  class MockOpenAI {
    chat = { completions: { create: mockCreate } };
  }
  return { default: MockOpenAI };
});

import { createOpenAiAdapter } from "./openai-adapter";

function okResponse(overrides: Record<string, unknown> = {}) {
  return {
    choices: [
      {
        message: { role: "assistant", content: "ok" },
        finish_reason: "stop",
      },
    ],
    model: "gpt-4o",
    ...overrides,
  };
}

function tool(id: string): ToolDefinitionForModel {
  return {
    id,
    name: id,
    description: id,
    parameters: { type: "object", properties: {} },
  };
}

describe("createOpenAiAdapter", () => {
  const adapter = createOpenAiAdapter({
    baseURL: "https://test.api.com/v1",
    dialect: "openrouter",
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
    it("maps response to AiResponse", async () => {
      mockCreate.mockResolvedValueOnce(
        okResponse({
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
        }),
      );

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
      mockCreate.mockResolvedValueOnce(
        okResponse({
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
        }),
      );

      const result = await adapter.complete("sk-test", {
        ...baseParams,
        reasoning: { effort: "high" },
      });

      expect(result.reasoning).toBe("I thought about it");
    });

    it("strips cache_control from messages", async () => {
      mockCreate.mockResolvedValueOnce(okResponse());

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
      // `withTrailingCacheControl` wraps the most recent tool result into a
      // TextContentPart array. The tool branch must not check
      // `typeof content === "string"` and drop the array, or the tool
      // result comes through empty.
      mockCreate.mockResolvedValueOnce(okResponse());

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

      await adapter.complete("sk-test", { ...baseParams, messages });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.messages[1]).toEqual({
        role: "tool",
        tool_call_id: "call_1",
        content: '{"success":true,"chapters":["one"]}',
      });
    });

    it("preserves cache_control on tool messages for Anthropic-via-OpenRouter models", async () => {
      // For OpenRouter routing to Anthropic, cache_control on tool result
      // messages must survive the conversion — otherwise the trailing
      // breakpoint set by withTrailingCacheControl is dropped on every
      // tool-calling iteration, busting the prompt cache.
      mockCreate.mockResolvedValueOnce(
        okResponse({ model: "anthropic/claude-sonnet-4-5" }),
      );

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

      await adapter.complete("sk-test", {
        ...baseParams,
        model: "anthropic/claude-sonnet-4-5",
        messages,
      });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.messages[1]).toEqual({
        role: "tool",
        tool_call_id: "call_1",
        content: [
          {
            type: "text",
            text: '{"success":true,"chapters":["one"]}',
            cache_control: { type: "ephemeral" },
          },
        ],
      });
    });

    it("sends tool messages as content arrays even without cache_control (Anthropic route)", async () => {
      // Wire shape must stay stable across tool-calling iterations: a tool
      // result that was the trailing message on iter N (with cache_control,
      // sent as array) and is no longer trailing on iter N+1 (no cache_control)
      // must still serialize as an array, not flip back to a string. The
      // string flip would change the prefix bytes Anthropic uses to look up
      // the prompt cache, busting the cache between iterations.
      mockCreate.mockResolvedValueOnce(
        okResponse({ model: "anthropic/claude-sonnet-4-5" }),
      );

      const messages: AiMessage[] = [
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_1", name: "list", arguments: {} }],
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
      expect(toolMsg.content).toEqual([
        { type: "text", text: '{"success":true,"chapters":["one"]}' },
      ]);
    });

    it("attaches cache_control to last tool entry only for Anthropic models", async () => {
      mockCreate.mockResolvedValueOnce(
        okResponse({ model: "anthropic/claude-sonnet-4-5" }),
      );

      await adapter.complete("sk-test", {
        ...baseParams,
        model: "anthropic/claude-sonnet-4-5",
        tools: [tool("a"), tool("b")],
      });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.tools).toHaveLength(2);
      expect(createCall.tools[0].cache_control).toBeUndefined();
      expect(createCall.tools[1].cache_control).toEqual({ type: "ephemeral" });
    });

    it("surfaces OpenRouter cache stats on usage", async () => {
      mockCreate.mockResolvedValueOnce(
        okResponse({
          model: "anthropic/claude-sonnet-4-5",
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 50,
            total_tokens: 1050,
            prompt_tokens_details: { cached_tokens: 800 },
            cache_write_tokens: 200,
          },
        }),
      );

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

    it("passes reasoning parameter through for non-Claude-4.6 models", async () => {
      mockCreate.mockResolvedValueOnce(okResponse({ model: "o1" }));

      await adapter.complete("sk-test", {
        ...baseParams,
        reasoning: { effort: "high" },
      });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.reasoning).toEqual({ effort: "high" });
    });

    it("maps reasoning effort to verbosity for Claude 4.6 via OpenRouter", async () => {
      mockCreate.mockResolvedValueOnce(
        okResponse({ model: "anthropic/claude-sonnet-4.6" }),
      );

      await adapter.complete("sk-test", {
        ...baseParams,
        model: "anthropic/claude-sonnet-4.6",
        reasoning: { effort: "high" },
      });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.reasoning).toEqual({ enabled: true });
      expect(createCall.verbosity).toBe("high");
    });

    it.each([
      ["stop", "stop"],
      ["length", "length"],
      ["content_filter", "content_filter"],
      ["other", "unknown"],
      [null, "stop"],
    ] as const)("normalizes finish_reason %s to %s", async (raw, expected) => {
      mockCreate.mockResolvedValueOnce(
        okResponse({
          choices: [
            {
              message: { role: "assistant", content: "ok" },
              finish_reason: raw,
            },
          ],
        }),
      );

      const result = await adapter.complete("sk-test", baseParams);
      expect(result.finishReason).toBe(expected);
    });

    it("reports tool_use and drops calls with malformed arguments", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockCreate.mockResolvedValueOnce(
        okResponse({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "u1",
                    type: "function",
                    function: { name: "broken", arguments: '{"q": "tr' },
                  },
                  {
                    id: "u2",
                    type: "function",
                    function: { name: "ok", arguments: '{"q":1}' },
                  },
                ],
              },
              finish_reason: "stop",
            },
          ],
        }),
      );

      const result = await adapter.complete("sk-test", baseParams);
      warn.mockRestore();

      expect(result.finishReason).toBe("tool_use");
      expect(result.toolCalls).toEqual([
        { id: expect.any(String), name: "ok", arguments: { q: 1 } },
      ]);
    });
  });

  describe("openai dialect", () => {
    const openai = createOpenAiAdapter({
      baseURL: "https://api.openai.com/v1",
      dialect: "openai",
    });

    it.each(["gpt-5", "o3-mini"])(
      "sends max_completion_tokens and reasoning_effort, and no temperature, for reasoning model %s",
      async (model) => {
        mockCreate.mockResolvedValueOnce(okResponse());

        await openai.complete("sk-test", {
          ...baseParams,
          model,
          reasoning: { effort: "high" },
        });

        const createCall = mockCreate.mock.calls[0][0];
        expect(createCall.max_completion_tokens).toBe(2048);
        expect(createCall.reasoning_effort).toBe("high");
        expect(createCall).not.toHaveProperty("max_tokens");
        expect(createCall).not.toHaveProperty("temperature");
        expect(createCall).not.toHaveProperty("reasoning");
      },
    );

    it.each([
      ["o3", "xhigh", "high"],
      ["o4-mini", "minimal", "low"],
      ["gpt-5", "minimal", "minimal"],
    ] as const)(
      "maps %s effort %s to reasoning_effort %s",
      async (model, effort, expected) => {
        mockCreate.mockResolvedValueOnce(okResponse());

        await openai.complete("sk-test", {
          ...baseParams,
          model,
          reasoning: { effort },
        });

        expect(mockCreate.mock.calls[0][0].reasoning_effort).toBe(expected);
      },
    );

    it("sends temperature and no reasoning params to a non-reasoning model", async () => {
      mockCreate.mockResolvedValueOnce(okResponse());

      await openai.complete("sk-test", {
        ...baseParams,
        model: "gpt-4o",
        reasoning: { effort: "high" },
      });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.max_completion_tokens).toBe(2048);
      expect(createCall.temperature).toBe(0.7);
      expect(createCall).not.toHaveProperty("reasoning_effort");
      expect(createCall).not.toHaveProperty("reasoning");
      expect(createCall).not.toHaveProperty("max_tokens");
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

    it.each([
      [
        "reasoning_details",
        { reasoning_details: [{ text: "thinking..." }] },
        "thinking...",
      ],
      ["direct reasoning field", { reasoning: "I think..." }, "I think..."],
    ] as const)(
      "yields a reasoning chunk from %s",
      async (_label, delta, expectedText) => {
        const chunks = [
          { choices: [{ delta, finish_reason: null }] },
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

        expect(results[0]).toEqual({ type: "reasoning", text: expectedText });
      },
    );

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

    it.each([
      ["stop", "stop"],
      ["no finish reason", null],
    ])(
      "emits accumulated tool calls with tool_use when upstream reports %s",
      async (_label, finishReason) => {
        const chunks = [
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 0, function: { name: "get", arguments: '{"a"' } },
                  ],
                },
                finish_reason: null,
              },
            ],
          },
          {
            choices: [
              {
                delta: {
                  tool_calls: [{ index: 0, function: { arguments: ":1}" } }],
                },
                finish_reason: finishReason,
              },
            ],
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

        expect(results).toEqual([
          {
            type: "tool_use",
            id: expect.any(String),
            name: "get",
            input: { a: 1 },
          },
          { type: "stop", finishReason: "tool_use" },
        ]);
      },
    );

    it("drops a streamed tool call with malformed arguments instead of throwing", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const chunks = [
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { name: "get", arguments: '{"a": "tr' },
                  },
                ],
              },
              finish_reason: "length",
            },
          ],
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
      warn.mockRestore();

      expect(results).toEqual([{ type: "stop", finishReason: "length" }]);
    });

    it("does not emit a call truncated right after its name when the turn hit length", async () => {
      const chunks = [
        {
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, function: { name: "delete_thing" } }],
              },
              finish_reason: "length",
            },
          ],
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

      expect(results).toEqual([{ type: "stop", finishReason: "length" }]);
    });
  });
});
