import { describe, expect, it } from "vitest";
import { normalizedIncludes } from "@/lib/punctuation-match";
import {
  type EditLocator,
  locateProposedEdit,
  spliceEdit,
} from "./edit-locator";

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
    // insert_at by anchor: a zero-width point at the anchor start.
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
