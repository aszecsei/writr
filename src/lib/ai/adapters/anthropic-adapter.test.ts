import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiMessage } from "../types";
import type { CompletionParams } from "./types";

// Mock the @anthropic-ai/sdk module
const mockCreate = vi.fn();
const mockStream = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: mockCreate, stream: mockStream };
  }
  return { default: MockAnthropic };
});

import { createAnthropicAdapter } from "./anthropic-adapter";

describe("createAnthropicAdapter", () => {
  const adapter = createAnthropicAdapter();

  beforeEach(() => {
    mockCreate.mockReset();
    mockStream.mockReset();
  });

  const baseParams: CompletionParams = {
    model: "claude-sonnet-4-5-20250929",
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
    ],
    temperature: 0.7,
    maxTokens: 2048,
  };

  describe("complete", () => {
    it("extracts system messages to system param", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "Hi!" }],
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await adapter.complete("sk-ant-test", baseParams);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.system).toEqual([
        { type: "text", text: "You are helpful." },
      ]);
      expect(createCall.messages).toEqual([{ role: "user", content: "Hello" }]);
    });

    it("preserves cache_control on system blocks", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "Hi!" }],
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const messages: AiMessage[] = [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: "cached prompt",
              cache_control: { type: "ephemeral" },
            },
          ],
        },
        { role: "user", content: "Hello" },
      ];

      await adapter.complete("sk-ant-test", { ...baseParams, messages });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.system[0].cache_control).toEqual({
        type: "ephemeral",
      });
    });

    it("converts image_url with base64 data URL to Anthropic image block", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "I see an image" }],
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const messages: AiMessage[] = [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
            },
            { type: "text", text: "What is this?" },
          ],
        },
      ];

      await adapter.complete("sk-ant-test", { ...baseParams, messages });

      const createCall = mockCreate.mock.calls[0][0];
      const userMsg = createCall.messages[0];
      expect(userMsg.content[0]).toEqual({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: "iVBORw0KGgo=",
        },
      });
    });

    it("converts image_url with regular URL to Anthropic url source", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "I see an image" }],
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const messages: AiMessage[] = [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: "https://example.com/image.png" },
            },
            { type: "text", text: "What is this?" },
          ],
        },
      ];

      await adapter.complete("sk-ant-test", { ...baseParams, messages });

      const createCall = mockCreate.mock.calls[0][0];
      const userMsg = createCall.messages[0];
      expect(userMsg.content[0]).toEqual({
        type: "image",
        source: { type: "url", url: "https://example.com/image.png" },
      });
    });

    it("maps reasoning effort to thinking budget", async () => {
      const effortMap = {
        minimal: 1024,
        low: 4096,
        medium: 10240,
        high: 20480,
        xhigh: 32768,
      } as const;

      for (const [effort, expectedBudget] of Object.entries(effortMap) as [
        keyof typeof effortMap,
        number,
      ][]) {
        mockCreate.mockResolvedValueOnce({
          content: [{ type: "text", text: "ok" }],
          model: "claude-sonnet-4-5-20250929",
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        await adapter.complete("sk-ant-test", {
          ...baseParams,
          reasoning: { effort },
        });

        const createCall =
          mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0];
        expect(createCall.thinking).toEqual({
          type: "enabled",
          budget_tokens: expectedBudget,
        });
      }
    });

    it("omits temperature when thinking is enabled", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "ok" }],
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await adapter.complete("sk-ant-test", {
        ...baseParams,
        reasoning: { effort: "high" },
      });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.temperature).toBeUndefined();
      expect(createCall.thinking).toBeDefined();
    });

    it("sets temperature when no reasoning", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "ok" }],
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await adapter.complete("sk-ant-test", baseParams);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.temperature).toBe(0.7);
    });

    it("maps response to AiResponse with text and thinking blocks", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: "thinking", thinking: "Let me think..." },
          { type: "text", text: "Here is my answer" },
        ],
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 20 },
      });

      const result = await adapter.complete("sk-ant-test", {
        ...baseParams,
        reasoning: { effort: "high" },
      });

      expect(result).toEqual({
        content: "Here is my answer",
        reasoning: "Let me think...",
        model: "claude-sonnet-4-5-20250929",
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
        finishReason: "stop",
      });
    });

    it("normalizes stop reasons", async () => {
      const stopMap: [string, string][] = [
        ["end_turn", "stop"],
        ["max_tokens", "length"],
        ["stop_sequence", "stop"],
      ];

      for (const [raw, expected] of stopMap) {
        mockCreate.mockResolvedValueOnce({
          content: [{ type: "text", text: "ok" }],
          model: "claude-sonnet-4-5-20250929",
          stop_reason: raw,
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const result = await adapter.complete("sk-ant-test", baseParams);
        expect(result.finishReason).toBe(expected);
      }
    });

    it("preserves tool message content when wrapped in a cache_control text part", async () => {
      // Regression: `withTrailingCacheControl` wraps the most recent history
      // message's string content into a TextContentPart array so Anthropic
      // prompt caching spans tool-calling iterations. Previously the tool
      // branch checked `typeof content === "string"` and silently dropped the
      // array, sending an empty tool_result back to the model on every
      // follow-up turn — exactly what reproduced as "I received an empty
      // result" after a successful list call.
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "ok" }],
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });

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
              text: '{"success":true,"chapters":["one","two"]}',
              cache_control: { type: "ephemeral" },
            },
          ],
        },
      ];

      await adapter.complete("sk-ant-test", { ...baseParams, messages });

      const createCall = mockCreate.mock.calls[0][0];
      const toolResultMsg = createCall.messages[1];
      expect(toolResultMsg.role).toBe("user");
      expect(toolResultMsg.content[0]).toEqual({
        type: "tool_result",
        tool_use_id: "call_1",
        content: '{"success":true,"chapters":["one","two"]}',
        cache_control: { type: "ephemeral" },
      });
    });

    it("attaches cache_control to the last tool entry only", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "ok" }],
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await adapter.complete("sk-ant-test", {
        ...baseParams,
        tools: [
          {
            id: "tool_a",
            name: "tool_a",
            description: "A",
            parameters: { type: "object", properties: {} },
          },
          {
            id: "tool_b",
            name: "tool_b",
            description: "B",
            parameters: { type: "object", properties: {} },
          },
          {
            id: "tool_c",
            name: "tool_c",
            description: "C",
            parameters: { type: "object", properties: {} },
          },
        ],
      });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.tools).toHaveLength(3);
      expect(createCall.tools[0].cache_control).toBeUndefined();
      expect(createCall.tools[1].cache_control).toBeUndefined();
      expect(createCall.tools[2].cache_control).toEqual({ type: "ephemeral" });
    });

    it("preserves plain-text content-part arrays even without images or cache_control", async () => {
      // Wire shape must stay stable across tool-calling iterations: previously
      // this branch joined text parts back into a string when nothing carried
      // cache_control or an image, but that flipped a previously-trailing
      // message from array form (iter N) to string form (iter N+1), busting
      // Anthropic's prefix-byte cache match between iterations.
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "ok" }],
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const messages: AiMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Part 1 " },
            { type: "text", text: "Part 2" },
          ],
        },
      ];

      await adapter.complete("sk-ant-test", { ...baseParams, messages });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.messages[0].content).toEqual([
        { type: "text", text: "Part 1 " },
        { type: "text", text: "Part 2" },
      ]);
    });
  });

  describe("stream", () => {
    it("yields content and reasoning chunks", async () => {
      const events = [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "hmm..." },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hello" },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: " world" },
        },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
        },
      ];

      mockStream.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const event of events) yield event;
        },
      });

      const results: unknown[] = [];
      for await (const chunk of adapter.stream("sk-ant-test", baseParams)) {
        results.push(chunk);
      }

      expect(results).toEqual([
        { type: "reasoning", text: "hmm..." },
        { type: "content", text: "Hello" },
        { type: "content", text: " world" },
        { type: "stop", finishReason: "stop" },
      ]);
    });

    it("handles stream with no thinking blocks", async () => {
      const events = [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Just text" },
        },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
        },
      ];

      mockStream.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const event of events) yield event;
        },
      });

      const results: unknown[] = [];
      for await (const chunk of adapter.stream("sk-ant-test", baseParams)) {
        results.push(chunk);
      }

      expect(results).toEqual([
        { type: "content", text: "Just text" },
        { type: "stop", finishReason: "stop" },
      ]);
    });

    it("emits usage on stop with cache tokens folded into prompt_tokens", async () => {
      const events = [
        {
          type: "message_start",
          message: {
            usage: {
              input_tokens: 100,
              cache_creation_input_tokens: 50,
              cache_read_input_tokens: 200,
              output_tokens: 0,
            },
          },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "answer" },
        },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: { output_tokens: 30 },
        },
      ];

      mockStream.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const event of events) yield event;
        },
      });

      const results: unknown[] = [];
      for await (const chunk of adapter.stream("sk-ant-test", baseParams)) {
        results.push(chunk);
      }

      const stop = results.find(
        (c): c is { type: "stop"; usage: unknown } =>
          (c as { type?: string }).type === "stop",
      );
      expect(stop?.usage).toEqual({
        // 100 input + 50 cache creation + 200 cache read = 350
        prompt_tokens: 350,
        completion_tokens: 30,
        total_tokens: 380,
        cache_creation_tokens: 50,
        cache_read_tokens: 200,
      });
    });

    it("complete() folds cache tokens into prompt_tokens and surfaces them discretely", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "ok" }],
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "end_turn",
        usage: {
          input_tokens: 100,
          cache_creation_input_tokens: 50,
          cache_read_input_tokens: 200,
          output_tokens: 30,
        },
      });

      const result = await adapter.complete("sk-ant-test", baseParams);

      expect(result.usage).toEqual({
        prompt_tokens: 350,
        completion_tokens: 30,
        total_tokens: 380,
        cache_creation_tokens: 50,
        cache_read_tokens: 200,
      });
    });
  });
});
