import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiStreamChunk } from "../types";
import type {
  AssistantTurnFinalizeInfo,
  ChatHistoryAccessor,
  ToolMessagePatch,
} from "./accessor";
import type { Agent, ResolvedAgentModel } from "./types";

const executeAgentTool = vi.fn();
vi.mock("./tool-filter", () => ({
  getToolDefinitionsForAgent: () => [
    {
      id: "get",
      name: "get",
      description: "get",
      parameters: { type: "object", properties: {} },
    },
  ],
  getAgentToolDefinition: (name: string) =>
    name === "get" || name === "list"
      ? { id: name, name, requiresApproval: false }
      : undefined,
  executeAgentTool: (...args: unknown[]) => executeAgentTool(...args),
}));

import { runAgent } from "./runner";

const model: ResolvedAgentModel = {
  apiKey: "key",
  provider: "anthropic",
  model: "claude-sonnet-4-5",
};

const agent = {
  kind: "custom",
  buildMessages: ({ history }) => history,
  agentContext: {},
} as Agent;

function recordingHistory() {
  const calls = {
    started: [] as string[],
    removed: [] as string[],
    finalized: [] as { id: string; info: AssistantTurnFinalizeInfo }[],
    chunks: [] as AiStreamChunk[],
    toolPatches: [] as { id: string; patch: ToolMessagePatch }[],
  };
  let n = 0;
  const history: ChatHistoryAccessor = {
    getMessages: () => [{ role: "user", content: "hi" }],
    startAssistantTurn: () => {
      const id = `a${++n}`;
      calls.started.push(id);
      return id;
    },
    appendChunk: (_id, chunk) => {
      calls.chunks.push(chunk);
    },
    appendPendingToolMessages: (_id, entries) =>
      entries.map((_, i) => `t${n}-${i}`),
    updateToolMessage: (id, patch) => {
      calls.toolPatches.push({ id, patch });
    },
    finalizeAssistantTurn: (id, info) => {
      calls.finalized.push({ id, info });
    },
    removeAssistantTurn: (id) => {
      calls.removed.push(id);
    },
  };
  return { history, calls };
}

function sse(chunks: AiStreamChunk[]): string {
  return `${chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("")}data: [DONE]\n\n`;
}

function streamResponse(body: string): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  executeAgentTool.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runAgent", () => {
  it("executes parallel streamed tool calls, replays thinking blocks, then runs a second iteration", async () => {
    const thinking = {
      type: "thinking" as const,
      thinking: "plan",
      signature: "sig",
    };
    fetchMock
      .mockResolvedValueOnce(
        streamResponse(
          sse([
            { type: "reasoning", text: "plan" },
            { type: "thinking_block", block: thinking },
            { type: "tool_use", id: "c1", name: "get", input: { a: 1 } },
            { type: "tool_use", id: "c2", name: "list", input: { b: 2 } },
            { type: "stop", finishReason: "tool_use" },
          ]),
        ),
      )
      .mockResolvedValueOnce(
        streamResponse(
          sse([
            { type: "content", text: "done" },
            { type: "stop", finishReason: "stop" },
          ]),
        ),
      );
    executeAgentTool.mockResolvedValue({ success: true, message: "ok" });
    const { history, calls } = recordingHistory();

    const result = await runAgent({ agent, model, history });

    expect(result).toEqual({ content: "done", aborted: false });
    expect(executeAgentTool).toHaveBeenCalledTimes(2);
    expect(calls.finalized[0].info).toMatchObject({
      finishReason: "tool_use",
      toolCallRefs: [
        { id: "c1", name: "get", arguments: { a: 1 } },
        { id: "c2", name: "list", arguments: { b: 2 } },
      ],
      thinkingBlocks: [thinking],
    });
    expect(calls.finalized[1].info.finishReason).toBe("stop");
    expect(calls.chunks).not.toContainEqual(
      expect.objectContaining({ type: "thinking_block" }),
    );
  });

  it("removes the turn, cancels the reader, and returns aborted when aborted between reads", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: "content", text: "par" })}\n\n`,
              ),
            );
          },
          pull() {
            // Abort while the runner is waiting on the next read.
            controller.abort();
            return new Promise(() => {});
          },
          cancel,
        }),
        { status: 200 },
      ),
    );
    const { history, calls } = recordingHistory();

    const result = await runAgent({
      agent,
      model,
      history,
      signal: controller.signal,
    });

    expect(result.aborted).toBe(true);
    expect(calls.removed).toEqual(["a1"]);
    expect(calls.finalized).toEqual([]);
    expect(cancel).toHaveBeenCalled();
  });

  it("removes the turn and returns aborted when a pending read rejects with AbortError", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          pull(c) {
            // What fetch does to the body stream when its signal aborts.
            controller.abort();
            c.error(
              new DOMException("The operation was aborted.", "AbortError"),
            );
          },
        }),
        { status: 200 },
      ),
    );
    const { history, calls } = recordingHistory();

    const result = await runAgent({
      agent,
      model,
      history,
      signal: controller.signal,
    });

    expect(result.aborted).toBe(true);
    expect(calls.removed).toEqual(["a1"]);
    expect(calls.finalized).toEqual([]);
  });

  it("removes the turn and returns aborted when fetch rejects with AbortError", async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException("The operation was aborted.", "AbortError"),
    );
    const { history, calls } = recordingHistory();

    const result = await runAgent({ agent, model, history });

    expect(result.aborted).toBe(true);
    expect(calls.removed).toEqual(["a1"]);
  });

  it("removes the turn and rethrows a non-abort stream error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          pull(c) {
            c.error(new TypeError("network down"));
          },
        }),
        { status: 200 },
      ),
    );
    const { history, calls } = recordingHistory();

    await expect(runAgent({ agent, model, history })).rejects.toThrow(
      "network down",
    );
    expect(calls.removed).toEqual(["a1"]);
    expect(calls.finalized).toEqual([]);
  });

  it("forwards tool calls, signatures, and thinking blocks from a non-streamed response", async () => {
    const thinking = { type: "redacted_thinking" as const, data: "opaque" };
    fetchMock
      .mockResolvedValueOnce(
        Response.json({
          content: "",
          model: "m",
          finishReason: "tool_use",
          toolCalls: [
            {
              id: "c1",
              name: "get",
              arguments: { a: 1 },
              thoughtSignature: "gsig",
            },
          ],
          thinkingBlocks: [thinking],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ content: "done", model: "m", finishReason: "stop" }),
      );
    executeAgentTool.mockResolvedValue({ success: true, message: "ok" });
    const { history, calls } = recordingHistory();

    const result = await runAgent({ agent, model, history, stream: false });

    expect(result.content).toBe("done");
    expect(calls.finalized[0].info).toMatchObject({
      toolCallRefs: [
        {
          id: "c1",
          name: "get",
          arguments: { a: 1 },
          thoughtSignature: "gsig",
        },
      ],
      thinkingBlocks: [thinking],
    });
  });
});
