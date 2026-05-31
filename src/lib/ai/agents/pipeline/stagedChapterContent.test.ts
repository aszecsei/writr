import { describe, expect, it } from "vitest";
import type {
  AgentRunId,
  ChapterId,
  ProjectId,
  ProposedEdit,
  ProposedEditId,
  WorkUnitId,
} from "@/db/schemas";
import { normalizedIncludes } from "@/lib/punctuation-match";
import {
  applyEditsToContent,
  type EditLocator,
  locateProposedEdit,
  spliceEdit,
} from "./stagedChapterContent";

const ts = "2024-01-01T00:00:00.000Z";

function makeEdit(overrides: Partial<ProposedEdit>): ProposedEdit {
  return {
    id: overrides.id ?? ("edit-x" as ProposedEditId),
    projectId: "00000000-0000-4000-8000-000000000001" as ProjectId,
    runId: "00000000-0000-4000-8000-000000000002" as AgentRunId,
    workUnitId: "00000000-0000-4000-8000-000000000003" as WorkUnitId,
    chapterId: "00000000-0000-4000-8000-000000000004" as ChapterId,
    kind: "replace",
    anchorText: "",
    newContent: "",
    rationale: "",
    status: "approved",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  } as ProposedEdit;
}

describe("applyEditsToContent", () => {
  it("applies a single replace edit using the combined locator", () => {
    const content = "the dog ran swiftly down the road";
    const edit = makeEdit({
      id: "e1" as ProposedEditId,
      kind: "replace",
      anchorText: "ran swiftly down",
      newContent: "tore down",
    });
    const {
      content: out,
      applied,
      skipped,
    } = applyEditsToContent(content, [edit]);
    expect(out).toBe("the dog tore down the road");
    expect(applied).toEqual(["e1"]);
    expect(skipped).toEqual([]);
  });

  it("uses prefix/suffix to disambiguate a repeated anchor", () => {
    const content = "the good dog and the bad dog ran home";
    const edit = makeEdit({
      id: "e1" as ProposedEditId,
      kind: "replace",
      prefix: "the bad ",
      anchorText: "dog",
      suffix: " ran",
      newContent: "wolf",
    });
    const { content: out } = applyEditsToContent(content, [edit]);
    expect(out).toBe("the good dog and the bad wolf ran home");
  });

  it("skips a replace edit when the combined locator is no longer present", () => {
    const content = "completely different prose now";
    const edit = makeEdit({
      id: "e1" as ProposedEditId,
      kind: "replace",
      anchorText: "ran swiftly down",
      newContent: "tore down",
    });
    const {
      content: out,
      applied,
      skipped,
    } = applyEditsToContent(content, [edit]);
    expect(out).toBe(content);
    expect(applied).toEqual([]);
    expect(skipped).toEqual(["e1"]);
  });

  it("applies two replace edits in the same chapter without clobbering each other", () => {
    const content = "alpha beta gamma delta epsilon";
    // Edits supplied in input order — locator decides apply order.
    const editEarly = makeEdit({
      id: "early" as ProposedEditId,
      kind: "replace",
      anchorText: "beta",
      newContent: "BETA",
    });
    const editLate = makeEdit({
      id: "late" as ProposedEditId,
      kind: "replace",
      anchorText: "delta",
      newContent: "DELTA",
    });
    const {
      content: out,
      applied,
      skipped,
    } = applyEditsToContent(content, [editEarly, editLate]);
    expect(out).toBe("alpha BETA gamma DELTA epsilon");
    expect(applied).toContain("early");
    expect(applied).toContain("late");
    expect(skipped).toEqual([]);
  });

  it("resolves a replace anchor whose quotes differ from the chapter's", () => {
    // Chapter stores curly quotes (TipTap Typography output); LLM emitted
    // straight quotes in its tool call. Match must still locate the anchor
    // and splice using the chapter's original character positions.
    const content = "She said “hello” and waved.";
    const edit = makeEdit({
      id: "e1" as ProposedEditId,
      kind: "replace",
      anchorText: 'said "hello"',
      newContent: 'whispered "hi"',
    });
    const {
      content: out,
      applied,
      skipped,
    } = applyEditsToContent(content, [edit]);
    expect(out).toBe('She whispered "hi" and waved.');
    expect(applied).toEqual(["e1"]);
    expect(skipped).toEqual([]);
  });

  it("resolves an insert_at anchor whose apostrophe differs from the chapter's", () => {
    const content = "Don’t do that.";
    const edit = makeEdit({
      id: "e1" as ProposedEditId,
      kind: "insert_at",
      anchorText: "Don't",
      fromOffset: undefined,
      newContent: " really",
    });
    const { content: out, applied } = applyEditsToContent(content, [edit]);
    expect(out).toBe(" reallyDon’t do that.");
    expect(applied).toEqual(["e1"]);
  });

  it("applies append + replace together correctly", () => {
    const content = "first sentence.";
    const replaceEdit = makeEdit({
      id: "r" as ProposedEditId,
      kind: "replace",
      anchorText: "first",
      newContent: "First",
    });
    const appendEdit = makeEdit({
      id: "a" as ProposedEditId,
      kind: "append",
      newContent: " Second sentence.",
    });
    const { content: out } = applyEditsToContent(content, [
      replaceEdit,
      appendEdit,
    ]);
    expect(out).toBe("First sentence. Second sentence.");
  });
});

// The chat-mode Apply path (ChapterEditor) passes a `PendingStagedEdit`, which
// is structurally an `EditLocator` (no id / DB fields). These cover that shape
// directly and lock in the cases the old PM-doc-text locator silently dropped:
// anchors touching markdown syntax or spanning block boundaries. The chapter
// string here is markdown — the same representation `propose_edit` validates
// its anchor against.
describe("locateProposedEdit (chat-shaped EditLocator)", () => {
  function locateAndSlice(content: string, edit: EditLocator): string | null {
    const range = locateProposedEdit(content, edit);
    return range ? content.slice(range.from, range.to) : null;
  }

  it("locates a replace anchor adjacent to bold markers", () => {
    const content = "She felt **utterly** lost in the crowd.";
    const edit: EditLocator = {
      kind: "replace",
      anchorText: "**utterly** lost",
    };
    expect(locateAndSlice(content, edit)).toBe("**utterly** lost");
    const range = locateProposedEdit(content, edit);
    if (!range) throw new Error("expected a range");
    expect(spliceEdit(content, range, "completely adrift")).toBe(
      "She felt completely adrift in the crowd.",
    );
  });

  it("locates a replace anchor inside a heading", () => {
    const content = "# The Long Road\n\nIt was dark.";
    const edit: EditLocator = { kind: "replace", anchorText: "Long Road" };
    expect(locateAndSlice(content, edit)).toBe("Long Road");
  });

  it("locates a replace anchor that spans a block boundary", () => {
    // The old PM-flatten locator required the anchor inside a single text node
    // and returned null here; the markdown locator finds it directly.
    const content = "Para one.\n\nPara two.";
    const edit: EditLocator = { kind: "replace", anchorText: "one.\n\nPara" };
    expect(locateAndSlice(content, edit)).toBe("one.\n\nPara");
  });

  it("locates a replace with prefix/suffix spanning paragraph breaks", () => {
    const content = "Intro line.\n\nThe middle.\n\nThe end.";
    const edit: EditLocator = {
      kind: "replace",
      prefix: "Intro line.\n\nThe ",
      anchorText: "middle",
      suffix: ".\n\nThe end.",
    };
    expect(locateAndSlice(content, edit)).toBe("middle");
  });

  it("tolerates straight-vs-curly quote mismatch for a chat-shaped anchor", () => {
    const content = "He said “stop” at once.";
    const edit: EditLocator = { kind: "replace", anchorText: 'said "stop"' };
    // Returns positions into the ORIGINAL (curly) string.
    expect(locateAndSlice(content, edit)).toBe("said “stop”");
  });

  it("resolves all four kinds", () => {
    const content = "alpha bravo charlie";
    expect(locateProposedEdit(content, { kind: "full_chapter" })).toEqual({
      from: 0,
      to: content.length,
    });
    expect(locateProposedEdit(content, { kind: "append" })).toEqual({
      from: content.length,
      to: content.length,
    });
    // insert_at by anchor: a zero-width point at the anchor start (consistent
    // with the pipeline applier).
    expect(
      locateProposedEdit(content, { kind: "insert_at", anchorText: "bravo" }),
    ).toEqual({ from: 6, to: 6 });
    // insert_at by offset.
    expect(
      locateProposedEdit(content, { kind: "insert_at", fromOffset: 5 }),
    ).toEqual({ from: 5, to: 5 });
  });

  it("returns null when a chat-shaped anchor is absent", () => {
    const content = "nothing to see here";
    expect(
      locateProposedEdit(content, { kind: "replace", anchorText: "missing" }),
    ).toBeNull();
  });
});

// Regression guard: the diff card enables Apply based on the tool's
// `anchorFound` check (markdown string), while the apply consumer locates via
// `locateProposedEdit`. If those two ever diverge again the bug returns — an
// enabled button that silently does nothing. This pins the invariant:
// anchorFound ⇒ locateProposedEdit resolves.
describe("apply-locator stays consistent with the tool's anchorFound gate", () => {
  // Mirror of the chat-mode `anchorFound` computation in tools/proposedEdits.ts.
  function toolAnchorFound(content: string, e: EditLocator): boolean {
    switch (e.kind) {
      case "append":
      case "full_chapter":
        return true;
      case "replace":
        return normalizedIncludes(
          content,
          (e.prefix ?? "") + (e.anchorText ?? "") + (e.suffix ?? ""),
        );
      case "insert_at":
        return (
          e.anchorText !== undefined &&
          normalizedIncludes(content, e.anchorText)
        );
    }
  }

  const corpus: { content: string; edit: EditLocator }[] = [
    { content: "plain prose here", edit: { kind: "full_chapter" } },
    { content: "plain prose here", edit: { kind: "append" } },
    {
      content: "She felt **utterly** lost.",
      edit: { kind: "replace", anchorText: "**utterly** lost" },
    },
    {
      content: "# Heading\n\nBody text.",
      edit: { kind: "replace", anchorText: "Heading" },
    },
    {
      content: "Para one.\n\nPara two.",
      edit: { kind: "replace", anchorText: "one.\n\nPara" },
    },
    {
      content: "He said “stop”.",
      edit: { kind: "replace", anchorText: 'said "stop"' },
    },
    {
      content: "Don’t stop now.",
      edit: { kind: "insert_at", anchorText: "Don't" },
    },
  ];

  it("returns a range for every edit whose anchor the tool reports as found", () => {
    for (const { content, edit } of corpus) {
      if (toolAnchorFound(content, edit)) {
        expect(
          locateProposedEdit(content, edit),
          `anchorFound was true but locate returned null for ${JSON.stringify(edit)}`,
        ).not.toBeNull();
      }
    }
  });
});
