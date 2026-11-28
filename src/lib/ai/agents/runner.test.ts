import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectId } from "@/db/schemas";
import { makeAppSettings } from "@/test/helpers";
import type { ToolCallEntry } from "../tool-calling";
import { isTerminalToolStatus, toolResultContent } from "../tool-calling";
import type { AiMessage, AiStreamChunk, ThinkingBlock } from "../types";
import type {
  AccessorMessageId,
  AssistantTurnFinalizeInfo,
  ChatHistoryAccessor,
  ToolMessagePatch,
} from "./accessor";
import { resolveAgentModel, runAgent } from "./runner";
import * as toolFilter from "./tool-filter";
import type { Agent, ResolvedAgentModel } from "./types";

vi.mock("./tool-filter", { spy: true });

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const encoder = new TextEncoder();

interface FakeHistoryState {
  messages: AiMessage[];
  chunks: Array<{ id: AccessorMessageId; chunk: AiStreamChunk }>;
  finalized: Array<{ id: AccessorMessageId; info: AssistantTurnFinalizeInfo }>;
  removed: AccessorMessageId[];
  toolUpdates: Array<{ id: AccessorMessageId; patch: ToolMessagePatch }>;
  toolStatuses: Map<AccessorMessageId, ToolCallEntry["status"]>;
  accessor: ChatHistoryAccessor;
}

function makeFakeHistory(opts?: {
  initial?: AiMessage[];
  approveToolCall?: (toolMessageId: AccessorMessageId) => Promise<boolean>;
}): FakeHistoryState {
  const messages: AiMessage[] = opts?.initial
    ? [...opts.initial]
    : [{ role: "user", content: "Hello" }];
  const chunks: FakeHistoryState["chunks"] = [];
  const finalized: FakeHistoryState["finalized"] = [];
  const removed: AccessorMessageId[] = [];
  const toolUpdates: FakeHistoryState["toolUpdates"] = [];
  const toolStatuses = new Map<AccessorMessageId, ToolCallEntry["status"]>();

  let nextTurn = 0;
  let nextTool = 0;
  const draftContent = new Map<AccessorMessageId, string>();
  const toolEntries = new Map<AccessorMessageId, ToolCallEntry>();

  const accessor: ChatHistoryAccessor = {
    getMessages: () => messages,
    startAssistantTurn() {
      const id = `turn_${++nextTurn}`;
      draftContent.set(id, "");
      return id;
    },
    appendChunk(id, chunk) {
      chunks.push({ id, chunk });
      if (chunk.type === "content") {
        draftContent.set(id, (draftContent.get(id) ?? "") + chunk.text);
      }
    },
    appendPendingToolMessages(_assistantId, entries) {
      return entries.map((entry) => {
        const id = `tool_${++nextTool}`;
        toolEntries.set(id, { ...entry });
        toolStatuses.set(id, entry.status);
        return id;
      });
    },
    updateToolMessage(toolMessageId, patch) {
      toolUpdates.push({ id: toolMessageId, patch });
      const entry = toolEntries.get(toolMessageId);
      if (!entry) return;
      const wasTerminal = isTerminalToolStatus(entry.status);
      if (patch.status !== undefined) {
        entry.status = patch.status;
        toolStatuses.set(toolMessageId, patch.status);
      }
      if (patch.result !== undefined) entry.result = patch.result;
      if (isTerminalToolStatus(entry.status) && !wasTerminal) {
        messages.push({
          role: "tool",
          toolCallId: entry.id,
          content: toolResultContent(entry.status, entry.result),
        });
      }
    },
    finalizeAssistantTurn(id, info) {
      finalized.push({ id, info });
      messages.push({
        role: "assistant",
        content: draftContent.get(id) ?? "",
        ...(info.toolCallRefs?.length ? { toolCalls: info.toolCallRefs } : {}),
        ...(info.thinkingBlocks?.length
          ? { thinkingBlocks: info.thinkingBlocks }
          : {}),
      });
    },
    removeAssistantTurn(id) {
      removed.push(id);
      draftContent.delete(id);
    },
    approveToolCall: opts?.approveToolCall,
  };

  return {
    messages,
    chunks,
    finalized,
    removed,
    toolUpdates,
    toolStatuses,
    accessor,
  };
}

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    kind: "custom",
    enableToolCalling: true,
    allowedToolIds: ["list", "create_character"],
    buildMessages: ({ history }) => [...history],
    agentContext: { projectId },
    ...overrides,
  };
}

const baseModel: ResolvedAgentModel = {
  apiKey: "sk-test",
  provider: "anthropic",
  model: "claude-sonnet-4-5-20250929",
  reasoningEffort: "medium",
};

function sseResponse(
  chunks: Array<AiStreamChunk | "[DONE]">,
  opts?: { splitAt?: number },
): Response {
  const payload = chunks
    .map((c) =>
      c === "[DONE]" ? "data: [DONE]\n\n" : `data: ${JSON.stringify(c)}\n\n`,
    )
    .join("");
  const bytes = encoder.encode(payload);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (opts?.splitAt && opts.splitAt < bytes.length) {
        controller.enqueue(bytes.slice(0, opts.splitAt));
        controller.enqueue(bytes.slice(opts.splitAt));
      } else {
        controller.enqueue(bytes);
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("resolveAgentModel", () => {
  it("falls back to global AppSettings when no agent modelOverride is set", () => {
    const settings = makeAppSettings({
      aiProvider: "openai",
      providerModels: {
        ...makeAppSettings().providerModels,
        openai: "gpt-4o",
      },
      providerApiKeys: {
        ...makeAppSettings().providerApiKeys,
        openai: "sk-openai",
      },
      reasoningEffort: "high",
    });

    expect(resolveAgentModel(makeAgent(), settings)).toEqual({
      provider: "openai",
      model: "gpt-4o",
      apiKey: "sk-openai",
      reasoningEffort: "high",
    });
  });

  it("uses agent.modelOverride and inherits global reasoningEffort when override omits it", () => {
    const settings = makeAppSettings({
      aiProvider: "openai",
      providerApiKeys: {
        ...makeAppSettings().providerApiKeys,
        anthropic: "sk-ant",
      },
      reasoningEffort: "low",
    });

    const agent = makeAgent({
      modelOverride: {
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
      },
    });

    expect(resolveAgentModel(agent, settings)).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250929",
      apiKey: "sk-ant",
      reasoningEffort: "low",
    });
  });
});

describe("runAgent", () => {
  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(toolFilter.executeAgentTool).mockRestore();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("streams content, reasoning, and usage across split SSE frames", async () => {
    const history = makeFakeHistory();
    mockFetch.mockResolvedValueOnce(
      sseResponse(
        [
          { type: "reasoning", text: "Thinking..." },
          { type: "content", text: "Hello " },
          { type: "content", text: "world!" },
          {
            type: "stop",
            finishReason: "stop",
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          },
          "[DONE]",
        ],
        { splitAt: 25 },
      ),
    );

    const result = await runAgent({
      agent: makeAgent({ enableToolCalling: false }),
      model: baseModel,
      history: history.accessor,
    });

    expect(result).toEqual({ content: "Hello world!", aborted: false });
    expect(history.chunks).toEqual([
      { id: "turn_1", chunk: { type: "reasoning", text: "Thinking..." } },
      { id: "turn_1", chunk: { type: "content", text: "Hello " } },
      { id: "turn_1", chunk: { type: "content", text: "world!" } },
    ]);
    expect(history.finalized[0].info).toMatchObject({
      finishReason: "stop",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
  });

  it("handles non-streaming responses including thinkingBlocks and tool calls", async () => {
    const history = makeFakeHistory();
    const thinkingBlocks: ThinkingBlock[] = [
      { type: "thinking", thinking: "Plan", signature: "sig_1" },
    ];

    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: "",
            reasoning: "Plan",
            thinkingBlocks,
            model: baseModel.model,
            finishReason: "tool_use",
            toolCalls: [
              {
                id: "call_1",
                name: "list",
                arguments: { category: "character" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: "No characters found.",
            model: baseModel.model,
            finishReason: "stop",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const result = await runAgent({
      agent: makeAgent(),
      model: baseModel,
      history: history.accessor,
      stream: false,
    });

    expect(result).toEqual({ content: "No characters found.", aborted: false });
    expect(history.finalized[0].info.thinkingBlocks).toEqual(thinkingBlocks);
    const secondBody = JSON.parse(String(mockFetch.mock.calls[1][1]?.body));
    expect(secondBody.messages[1].thinkingBlocks).toEqual(thinkingBlocks);
    expect(secondBody.messages[2].role).toBe("tool");
  });

  it("executes parallel streamed tool calls and preserves thinkingBlocks across iterations", async () => {
    const history = makeFakeHistory();
    const thinkingBlock: ThinkingBlock = {
      type: "thinking",
      thinking: "Need both lists",
      signature: "sig_parallel",
    };

    mockFetch
      .mockResolvedValueOnce(
        sseResponse([
          { type: "reasoning", text: "Need both lists" },
          { type: "thinking_block", block: thinkingBlock },
          {
            type: "tool_use",
            id: "call_1",
            name: "list",
            input: { category: "character" },
          },
          {
            type: "tool_use",
            id: "call_2",
            name: "list",
            input: { category: "location" },
          },
          { type: "stop", finishReason: "tool_use" },
          "[DONE]",
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([
          { type: "content", text: "All checked." },
          { type: "stop", finishReason: "stop" },
          "[DONE]",
        ]),
      );

    const result = await runAgent({
      agent: makeAgent(),
      model: baseModel,
      history: history.accessor,
    });

    expect(result).toEqual({ content: "All checked.", aborted: false });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(String(mockFetch.mock.calls[1][1]?.body));
    expect(secondBody.messages[1]).toMatchObject({
      role: "assistant",
      thinkingBlocks: [thinkingBlock],
      toolCalls: [
        { id: "call_1", name: "list", arguments: { category: "character" } },
        { id: "call_2", name: "list", arguments: { category: "location" } },
      ],
    });
    expect(secondBody.messages[2].role).toBe("tool");
    expect(secondBody.messages[3].role).toBe("tool");
  });

  it("respects approveToolCall denial and records unknown tool errors", async () => {
    const approveToolCall = vi.fn().mockResolvedValueOnce(false);
    const history = makeFakeHistory({ approveToolCall });

    mockFetch
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "tool_use",
            id: "call_create",
            name: "create_character",
            input: { name: "Alice" },
          },
          {
            type: "tool_use",
            id: "call_unknown",
            name: "nonexistent_tool",
            input: {},
          },
          { type: "stop", finishReason: "tool_use" },
          "[DONE]",
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([
          { type: "content", text: "Understood." },
          { type: "stop", finishReason: "stop" },
          "[DONE]",
        ]),
      );

    const result = await runAgent({
      agent: makeAgent(),
      model: baseModel,
      history: history.accessor,
    });

    expect(result).toEqual({ content: "Understood.", aborted: false });
    expect(approveToolCall).toHaveBeenCalledTimes(1);
    expect(history.toolStatuses.get("tool_1")).toBe("denied");
    expect(history.toolStatuses.get("tool_2")).toBe("error");
  });

  it("marks remaining dispatched tool entries terminal if an earlier tool throws", async () => {
    const history = makeFakeHistory();
    vi.mocked(toolFilter.executeAgentTool).mockRejectedValueOnce(
      new Error("unexpected db crash"),
    );

    mockFetch.mockResolvedValueOnce(
      sseResponse([
        {
          type: "tool_use",
          id: "call_1",
          name: "list",
          input: { category: "character" },
        },
        {
          type: "tool_use",
          id: "call_2",
          name: "list",
          input: { category: "location" },
        },
        { type: "stop", finishReason: "tool_use" },
        "[DONE]",
      ]),
    );

    await expect(
      runAgent({
        agent: makeAgent(),
        model: baseModel,
        history: history.accessor,
      }),
    ).rejects.toThrow("unexpected db crash");

    expect(history.toolStatuses.get("tool_1")).toBe("error");
    expect(history.toolStatuses.get("tool_2")).toBe("denied");
  });

  it("removes the in-progress assistant turn and returns aborted: true when fetch throws AbortError", async () => {
    const history = makeFakeHistory();
    const controller = new AbortController();

    mockFetch.mockImplementationOnce(async () => {
      controller.abort();
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    });

    const result = await runAgent({
      agent: makeAgent(),
      model: baseModel,
      history: history.accessor,
      signal: controller.signal,
    });

    expect(result).toEqual({ content: "", aborted: true });
    expect(history.removed).toEqual(["turn_1"]);
    expect(history.finalized).toHaveLength(0);
  });

  it("cancels the stream reader and removes the assistant turn when reader.read() aborts", async () => {
    const history = makeFakeHistory();
    const controller = new AbortController();
    const cancelSpy = vi.fn().mockResolvedValue(undefined);
    let reads = 0;

    const stream = new ReadableStream<Uint8Array>({
      pull(streamController) {
        reads += 1;
        if (reads === 1) {
          streamController.enqueue(
            encoder.encode('data: {"type":"content","text":"Partial"}\n\n'),
          );
          return;
        }
        controller.abort();
        const err = new Error("Stream aborted");
        err.name = "AbortError";
        throw err;
      },
      cancel: cancelSpy,
    });

    mockFetch.mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const result = await runAgent({
      agent: makeAgent(),
      model: baseModel,
      history: history.accessor,
      signal: controller.signal,
    });

    expect(result).toEqual({ content: "Partial", aborted: true });
    expect(history.removed).toEqual(["turn_1"]);
    expect(history.finalized).toHaveLength(0);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it("removes the assistant turn and rethrows on non-abort network or HTTP errors", async () => {
    const history = makeFakeHistory();
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      runAgent({
        agent: makeAgent(),
        model: baseModel,
        history: history.accessor,
      }),
    ).rejects.toThrow("Failed to fetch");
    expect(history.removed).toEqual(["turn_1"]);

    const history2 = makeFakeHistory();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ details: "Bad gateway" }), { status: 502 }),
    );

    await expect(
      runAgent({
        agent: makeAgent(),
        model: baseModel,
        history: history2.accessor,
      }),
    ).rejects.toThrow("Bad gateway");
    expect(history2.removed).toEqual(["turn_1"]);
  });

  it("marks pending tools denied and exits cleanly when aborted during approveToolCall", async () => {
    const controller = new AbortController();
    const history = makeFakeHistory({
      approveToolCall: async () => {
        controller.abort();
        return false;
      },
    });

    mockFetch.mockResolvedValueOnce(
      sseResponse([
        {
          type: "tool_use",
          id: "call_1",
          name: "create_character",
          input: { name: "Bob" },
        },
        { type: "stop", finishReason: "tool_use" },
        "[DONE]",
      ]),
    );

    const result = await runAgent({
      agent: makeAgent(),
      model: baseModel,
      history: history.accessor,
      signal: controller.signal,
    });

    expect(result.aborted).toBe(true);
    expect(history.toolStatuses.get("tool_1")).toBe("denied");
  });

  it("stops once maxIterations is reached", async () => {
    const history = makeFakeHistory();
    mockFetch.mockImplementation(async () =>
      sseResponse([
        {
          type: "tool_use",
          id: `call_${mockFetch.mock.calls.length}`,
          name: "list",
          input: { category: "character" },
        },
        { type: "stop", finishReason: "tool_use" },
        "[DONE]",
      ]),
    );

    const result = await runAgent({
      agent: makeAgent({ maxIterations: 2 }),
      model: baseModel,
      history: history.accessor,
    });

    expect(result.aborted).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
