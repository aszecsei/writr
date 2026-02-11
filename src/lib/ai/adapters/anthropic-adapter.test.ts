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
      const effortMap: Record<string, number> = {
        minimal: 1024,
        low: 4096,
        medium: 10240,
        high: 20480,
        xhigh: 32768,
      };

      for (const [effort, expectedBudget] of Object.entries(effortMap)) {
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

    it("flattens plain-text content parts without images or cache_control", async () => {
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
      // Should be flattened to a plain string
      expect(createCall.messages[0].content).toBe("Part 1 Part 2");
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
  });
});
