import { describe, expect, it } from "vitest";
import type { Chapter, ChapterId, ProjectId } from "@/db/schemas";
import { makeGuardrailEntry } from "@/test/helpers";
import { withVoiceMandate } from "./agents/builtins/voice";
import { buildAgenticContext, buildMessages } from "./prompts";
import type { AiContext, AiMessage, TextContentPart } from "./types";

function emptyContext(overrides?: Partial<AiContext>): AiContext {
  return {
    projectTitle: "Test Novel",
    projectDescription: "",
    genre: "",
    styleGuide: [],
    guardrails: [],
    chapters: [],
    ...overrides,
  };
}

function makeChapter(overrides: Partial<Chapter> & { id: ChapterId }): Chapter {
  return {
    id: overrides.id,
    projectId: overrides.projectId ?? ("project-1" as ProjectId),
    title: overrides.title ?? "Untitled",
    order: overrides.order ?? 0,
    content: overrides.content ?? "",
    synopsis: overrides.synopsis ?? "",
    status: overrides.status ?? "draft",
    wordCount: overrides.wordCount ?? 0,
    parentChapterId: overrides.parentChapterId ?? null,
    section: overrides.section ?? "manuscript",
    kind: overrides.kind ?? "document",
    includeInCompile: overrides.includeInCompile ?? true,
    pageBreakBefore: overrides.pageBreakBefore ?? false,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00Z",
  };
}

function getSystemText(messages: AiMessage[]): string {
  const sys = messages.find((m) => m.role === "system");
  if (!sys) return "";
  if (typeof sys.content === "string") return sys.content;
  return (sys.content as TextContentPart[]).map((p) => p.text).join("");
}

function getFirstUserText(messages: AiMessage[]): string {
  const userMsg = messages.find((m) => m.role === "user");
  if (!userMsg) return "";
  if (typeof userMsg.content === "string") return userMsg.content;
  return (userMsg.content as TextContentPart[]).map((p) => p.text).join("");
}

describe("buildMessages", () => {
  it("places the agent system prompt inside a <task> block", () => {
    const msgs = buildMessages("Write a sonnet", emptyContext());
    const sys = getSystemText(msgs);
    expect(sys).toContain("<task>");
    expect(sys).toContain("Write a sonnet");
    expect(sys).toContain("</task>");
  });

  it("includes the project title in the bible context", () => {
    const msgs = buildMessages("agent prompt", emptyContext());
    const text = getFirstUserText(msgs);
    expect(text).toContain('<novel title="Test Novel"');
  });

  it("uses <screenplay> root tag for screenplay projects", () => {
    const msgs = buildMessages(
      "agent prompt",
      emptyContext({ projectMode: "screenplay" }),
    );
    expect(getFirstUserText(msgs)).toContain('<screenplay title="Test Novel"');
  });

  it("injects the active chapter as a separate user message when set", () => {
    const msgs = buildMessages(
      "agent prompt",
      emptyContext({
        currentChapterTitle: "Chapter 1",
        currentChapterContent: "Once upon a time...",
      }),
    );
    const userMessages = msgs.filter((m) => m.role === "user");
    // [0] = bible context, [1] = chapter (no synthetic user prompt anymore —
    // user messages come in via `history` already wire-formatted).
    expect(userMessages.length).toBeGreaterThanOrEqual(2);
    const chapterMsg = userMessages[1];
    const text =
      typeof chapterMsg.content === "string"
        ? chapterMsg.content
        : (chapterMsg.content as TextContentPart[]).map((p) => p.text).join("");
    expect(text).toContain('<chapter title="Chapter 1">');
    expect(text).toContain("Once upon a time...");
  });

  it("includes the chapter id on the active chapter block when set", () => {
    const msgs = buildMessages(
      "agent prompt",
      emptyContext({
        currentChapterId: "ch-123",
        currentChapterTitle: "Chapter 1",
        currentChapterContent: "Once upon a time...",
      }),
    );
    const chapterMsg = msgs.filter((m) => m.role === "user")[1];
    const text = (chapterMsg.content as TextContentPart[])
      .map((p) => p.text)
      .join("");
    expect(text).toContain('<chapter id="ch-123" title="Chapter 1">');
  });

  it("appends history messages verbatim (user content already wire-formatted)", () => {
    const history: AiMessage[] = [
      {
        role: "user",
        content:
          "<selected-text>\nfox\n</selected-text>\n\nrewrite this please",
      },
    ];
    const msgs = buildMessages("agent prompt", emptyContext(), history);
    const last = msgs[msgs.length - 1];
    expect(last.role).toBe("user");
    const text =
      typeof last.content === "string"
        ? last.content
        : (last.content as TextContentPart[]).map((p) => p.text).join("");
    expect(text).toContain("<selected-text>");
    expect(text).toContain("fox");
    expect(text).toContain("rewrite this please");
  });

  it("appends an assistant prefill at the end when provided", () => {
    const msgs = buildMessages("agent prompt", emptyContext(), [], {
      assistantPrefill: "Here's my response:",
    });
    const last = msgs[msgs.length - 1];
    expect(last.role).toBe("assistant");
    expect(last.content).toBe("Here's my response:");
  });

  it("respects customSystemPrompt as the preamble", () => {
    const msgs = buildMessages("agent prompt", emptyContext(), [], {
      customSystemPrompt: "You are a strict editor.",
    });
    const sys = getSystemText(msgs);
    expect(sys.startsWith("You are a strict editor.")).toBe(true);
  });

  it("does not reference the reader bible in the voice-mandated system prompt", () => {
    const msgs = buildMessages("agent prompt", emptyContext(), [], {
      customSystemPrompt: withVoiceMandate("You are a chat agent."),
    });
    const sys = getSystemText(msgs);
    expect(sys).not.toContain("reader bible");
  });

  it("emits a tool-calling-instructions block when enableToolCalling is on", () => {
    const msgs = buildMessages("agent prompt", emptyContext(), [], {
      enableToolCalling: true,
    });
    expect(getSystemText(msgs)).toContain("<tool-calling-instructions>");
  });

  it("uses the minimal agentic context when tool calling is enabled", () => {
    const msgs = buildMessages(
      "agent prompt",
      emptyContext({ projectDescription: "An epic." }),
      [],
      { enableToolCalling: true },
    );
    const text = getFirstUserText(msgs);
    expect(text).toContain("<description>An epic.</description>");
  });

  it("uses the same minimal context when tool calling is disabled (no full bible dump)", () => {
    const msgs = buildMessages(
      "agent prompt",
      emptyContext({ projectDescription: "An epic." }),
    );
    const text = getFirstUserText(msgs);
    expect(text).toContain("<description>An epic.</description>");
    expect(text).not.toContain("<characters>");
    expect(text).not.toContain("<locations>");
    expect(text).not.toContain("<timeline>");
    expect(text).not.toContain("<worldbuilding>");
    expect(text).not.toContain("<outline>");
    expect(text).not.toContain("<relationships>");
  });

  it("emits a chapter table-of-contents in the project context", () => {
    const msgs = buildMessages(
      "agent prompt",
      emptyContext({
        chapters: [
          makeChapter({
            id: "c1" as ChapterId,
            title: "The Beginning",
            order: 0,
          }),
          makeChapter({
            id: "c2" as ChapterId,
            title: "Rising Action",
            order: 1,
            status: "revised",
            wordCount: 1234,
          }),
        ],
      }),
    );
    const text = getFirstUserText(msgs);
    expect(text).toContain("<table-of-contents>");
    expect(text).toContain('id="c1"');
    expect(text).toContain('title="The Beginning"');
    expect(text).toContain('id="c2"');
    expect(text).toContain('title="Rising Action"');
    expect(text).toContain('status="revised"');
    expect(text).toContain('wordCount="1234"');
  });

  it("keeps history wire shape byte-stable across tool-calling iterations", () => {
    // The message trailing in iteration N must NOT flip from array form
    // (with cache_control) to string form (no cache_control) in iteration
    // N+1 — Anthropic's prompt cache is a prefix-byte match, so a shape flip
    // silently invalidates the conversation-prefix cache between
    // tool-calling iterations.
    const userQ1: AiMessage = { role: "user", content: "what's in chapter 3?" };
    const iter1 = buildMessages("agent prompt", emptyContext(), [userQ1], {
      enableToolCalling: true,
    });

    // Iter 2 simulates one tool round: assistant emitted a tool_use, harness
    // appended the assistant turn + the tool result.
    const iter2History: AiMessage[] = [
      userQ1,
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
    const iter2 = buildMessages("agent prompt", emptyContext(), iter2History, {
      enableToolCalling: true,
    });

    // Find userQ1 in both iterations. Its pure content bytes (text only,
    // ignoring the cache_control directive) must match — that's what
    // Anthropic hashes for the cache key.
    const findUserQ1 = (msgs: AiMessage[]): AiMessage | undefined =>
      msgs.find(
        (m) =>
          m.role === "user" &&
          (typeof m.content === "string"
            ? m.content === userQ1.content
            : m.content.some(
                (p) => p.type === "text" && p.text === userQ1.content,
              )),
      );
    const u1 = findUserQ1(iter1);
    const u2 = findUserQ1(iter2);
    if (!u1 || !u2) throw new Error("user_q1 not found in iter messages");

    // Both iterations must serialize userQ1 with the same structural shape.
    // Specifically: array form. Iter 1 has cache_control on the last text
    // part, iter 2 does not — that's expected (the marker moves to the new
    // trailing message). The shape itself must not flip.
    expect(Array.isArray(u1.content)).toBe(true);
    expect(Array.isArray(u2.content)).toBe(true);

    // Stripping cache_control, the bytes must match.
    const stripCacheControl = (parts: TextContentPart[]) =>
      parts.map((p) => ({ type: p.type, text: p.text }));
    expect(stripCacheControl(u1.content as TextContentPart[])).toEqual(
      stripCacheControl(u2.content as TextContentPart[]),
    );
  });

  it("injects post-chat instructions into the Nth-last history user message", () => {
    const history: AiMessage[] = [
      { role: "user", content: "first user turn" },
      { role: "assistant", content: "ack" },
      { role: "user", content: "second user turn" },
    ];
    const msgs = buildMessages("agent prompt", emptyContext(), history, {
      postChatInstructions: "Respond in JSON.",
      postChatInstructionsDepth: 1,
    });
    // Depth 1 = the most recent non-synthetic user message.
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    const text =
      typeof lastUser?.content === "string"
        ? lastUser.content
        : ((lastUser?.content as TextContentPart[]) ?? [])
            .map((p) => p.text)
            .join("");
    expect(text).toContain("Respond in JSON.");
    expect(text).toContain("second user turn");
  });
});

function baseContext(): AiContext {
  return {
    projectTitle: "T",
    projectDescription: "",
    genre: "",
    projectMode: "prose",
    styleGuide: [],
    guardrails: [],
    chapters: [],
  };
}

describe("buildMessages retrieval injection", () => {
  it("omits retrieval blocks when no retrieval data is present", () => {
    const msgs = buildMessages("sys", baseContext(), []);
    const text = JSON.stringify(msgs);
    expect(text).not.toContain("<relevant-lore>");
    expect(text).not.toContain("<past-events>");
    expect(text).not.toContain("<future-events>");
  });

  it("injects lore and past-events blocks when present", () => {
    const ctx = {
      ...baseContext(),
      relevantLore: [
        { title: "Funeral rites", text: "Veyrish burn their dead." },
      ],
      pastEvents: [{ title: "Chapter 1", text: "They met at the gate." }],
    };
    const msgs = buildMessages("sys", ctx, []);
    const text = JSON.stringify(msgs);
    expect(text).toContain("<relevant-lore>");
    expect(text).toContain("Veyrish burn their dead.");
    expect(text).toContain("<past-events>");
    expect(text).not.toContain("<future-events>");
  });

  it("injects a future-events block when present", () => {
    const ctx = {
      ...baseContext(),
      futureEvents: [{ title: "Chapter 9", text: "The betrayal." }],
    };
    const text = JSON.stringify(buildMessages("sys", ctx, []));
    expect(text).toContain("<future-events>");
    expect(text).toContain("Do not spoil");
  });
});

describe("buildAgenticContext", () => {
  it("emits an empty <novel> wrapper when only a title is set", () => {
    const xml = buildAgenticContext(emptyContext());
    expect(xml).toContain('<novel title="Test Novel"');
    expect(xml).toContain("</novel>");
  });

  it("includes description when present", () => {
    const xml = buildAgenticContext(
      emptyContext({ projectDescription: "Cool story." }),
    );
    expect(xml).toContain("<description>Cool story.</description>");
  });

  it("omits the table-of-contents block when no chapters exist", () => {
    const xml = buildAgenticContext(emptyContext());
    expect(xml).not.toContain("<table-of-contents>");
  });

  it("renders a table-of-contents listing chapter id/title/order", () => {
    const xml = buildAgenticContext(
      emptyContext({
        chapters: [
          makeChapter({ id: "c1" as ChapterId, title: "Opening", order: 0 }),
          makeChapter({ id: "c2" as ChapterId, title: "Climax", order: 1 }),
        ],
      }),
    );
    expect(xml).toContain("<table-of-contents>");
    expect(xml).toContain(
      '<chapter id="c1" order="0" depth="0" title="Opening"',
    );
    expect(xml).toContain(
      '<chapter id="c2" order="1" depth="0" title="Climax"',
    );
    expect(xml).toContain("</table-of-contents>");
  });

  it("emits a <guardrails> block when guardrails are present", () => {
    const xml = buildAgenticContext(
      emptyContext({
        guardrails: [
          makeGuardrailEntry({
            projectId: "p1" as ProjectId,
            label: "Filler comparisons",
            flags: ["the way a [comparison]"],
            fix: "Name what is present.",
            positiveFix: "Use the concrete detail.",
          }),
        ],
      }),
    );
    expect(xml).toContain("<guardrails>");
    expect(xml).toContain('<guardrail label="Filler comparisons">');
    expect(xml).toContain("<flag>the way a [comparison]</flag>");
    expect(xml).toContain("</guardrails>");
  });

  it("omits the <guardrails> block when none exist", () => {
    const xml = buildAgenticContext(emptyContext());
    expect(xml).not.toContain("<guardrails>");
  });

  it("escapes special characters in chapter titles and ids", () => {
    const xml = buildAgenticContext(
      emptyContext({
        chapters: [
          makeChapter({
            id: "c1" as ChapterId,
            title: 'Quotes "and" ampersands & angles',
            order: 0,
          }),
        ],
      }),
    );
    expect(xml).toContain(
      'title="Quotes &quot;and&quot; ampersands &amp; angles"',
    );
  });
});
