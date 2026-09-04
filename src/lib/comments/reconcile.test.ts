import { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import type { ChapterId, Comment, CommentId, ProjectId } from "@/db/schemas";
import { findAnchorPositionInDoc, reconcileComment } from "./reconcile";

const ts = "2024-01-01T00:00:00.000Z";

function makeComment(overrides: Partial<Comment>): Comment {
  return {
    id: "00000000-0000-4000-8000-000000000001" as CommentId,
    projectId: "00000000-0000-4000-8000-000000000010" as ProjectId,
    chapterId: "00000000-0000-4000-8000-000000000020" as ChapterId,
    content: "test comment",
    color: "yellow",
    fromOffset: 5,
    toOffset: 5,
    anchorText: "",
    status: "active",
    resolvedAt: null,
    parentCommentId: null,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

// Minimal PM schema for the doc-aware reconcile tests.
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
  },
});

function makePmDoc(...paragraphs: string[]) {
  return schema.node(
    "doc",
    null,
    paragraphs.map((p) =>
      schema.node("paragraph", null, p ? [schema.text(p)] : []),
    ),
  );
}

describe("reconcileComment", () => {
  // ─── Point comment without anchor ──────────────────────────────────

  describe("point comment without anchor", () => {
    it("returns exact when position is within bounds", () => {
      const comment = makeComment({
        fromOffset: 5,
        toOffset: 5,
        anchorText: "",
      });
      const result = reconcileComment(comment, "Hello, world!");
      expect(result).toEqual({ found: true, confidence: "exact" });
    });

    it("returns exact at boundary (length + 1)", () => {
      const text = "Hello";
      const comment = makeComment({
        fromOffset: 6,
        toOffset: 6,
        anchorText: "",
      });
      const result = reconcileComment(comment, text);
      expect(result).toEqual({ found: true, confidence: "exact" });
    });

    it("returns fuzzy with clamped position on empty document", () => {
      const comment = makeComment({
        fromOffset: 5,
        toOffset: 5,
        anchorText: "",
      });
      const result = reconcileComment(comment, "");
      expect(result).toEqual({
        found: true,
        newFrom: 1,
        newTo: 1,
        confidence: "fuzzy",
      });
    });
  });

  // ─── Range comment with non-truncated anchor ───────────────────────

  describe("range comment with non-truncated anchor", () => {
    it("returns exact when anchor found near position", () => {
      const text = "The quick brown fox jumps over the lazy dog";
      const comment = makeComment({
        fromOffset: 5,
        toOffset: 20,
        anchorText: "quick brown fox",
      });
      const result = reconcileComment(comment, text);
      expect(result).toEqual({ found: true, confidence: "exact" });
    });

    it("returns fuzzy when anchor found far away (global search)", () => {
      const padding = "x".repeat(1000);
      const text = `${padding}quick brown fox`;
      const comment = makeComment({
        fromOffset: 1,
        toOffset: 10,
        anchorText: "quick brown fox",
      });
      const result = reconcileComment(comment, text);
      expect(result).toEqual({ found: true, confidence: "fuzzy" });
    });

    it("returns not_found when anchor not in document", () => {
      const text = "The quick brown fox";
      const comment = makeComment({
        fromOffset: 1,
        toOffset: 10,
        anchorText: "lazy dog",
      });
      const result = reconcileComment(comment, text);
      expect(result).toEqual({ found: false, confidence: "not_found" });
    });

    it("falls through to bounds check when anchor contains ellipsis", () => {
      const text = "Hello world, this is a test";
      const comment = makeComment({
        fromOffset: 1,
        toOffset: 10,
        anchorText: "Hello...test",
      });
      const result = reconcileComment(comment, text);
      expect(result).toEqual({ found: true, confidence: "exact" });
    });
  });

  // ─── Point comment with anchor ─────────────────────────────────────

  describe("point comment with anchor", () => {
    it("returns exact when anchor found in document", () => {
      const text = "The quick brown fox";
      const comment = makeComment({
        fromOffset: 5,
        toOffset: 5,
        anchorText: "quick",
      });
      const result = reconcileComment(comment, text);
      expect(result).toEqual({ found: true, confidence: "exact" });
    });

    it("returns fuzzy when anchor not found", () => {
      const text = "The quick brown fox";
      const comment = makeComment({
        fromOffset: 5,
        toOffset: 5,
        anchorText: "missing text",
      });
      const result = reconcileComment(comment, text);
      expect(result).toEqual({ found: true, confidence: "fuzzy" });
    });
  });

  // ─── Range without anchor / truncated anchor ───────────────────────

  describe("range without anchor or with truncated anchor", () => {
    it("returns exact when bounds are valid", () => {
      const text = "Hello, world!";
      const comment = makeComment({
        fromOffset: 1,
        toOffset: 6,
        anchorText: "",
      });
      const result = reconcileComment(comment, text);
      expect(result).toEqual({ found: true, confidence: "exact" });
    });

    it.each([
      ["a point comment", 100, 100],
      ["a range comment", 50, 100],
    ])("clamps %s past the end of the text to fuzzy", (_label, from, to) => {
      const text = "Hi";
      const comment = makeComment({
        fromOffset: from,
        toOffset: to,
        anchorText: "",
      });
      const result = reconcileComment(comment, text);
      expect(result).toEqual({
        found: true,
        newFrom: 3,
        newTo: 3,
        confidence: "fuzzy",
      });
    });

    it("returns fuzzy with clamped positions on empty document", () => {
      const comment = makeComment({
        fromOffset: 5,
        toOffset: 10,
        anchorText: "",
      });
      const result = reconcileComment(comment, "");
      expect(result).toEqual({
        found: true,
        newFrom: 1,
        newTo: 1,
        confidence: "fuzzy",
      });
    });
  });

  // ─── Doc-aware reconciliation ──────────────────────────────────────

  describe("with editor doc (doc-aware)", () => {
    it("rewrites placeholder offsets to true PM positions", () => {
      // The AI `add_comment` tool writes 1 / 1+len as placeholders. With
      // the live PM doc supplied, reconcile locates the anchor and returns
      // the corrected positions.
      const doc = makePmDoc("First paragraph.", "Second paragraph here.");
      const located = findAnchorPositionInDoc(doc, "Second paragraph");
      expect(located).not.toBeNull();
      if (!located) return;

      const comment = makeComment({
        fromOffset: 1,
        toOffset: 1 + "Second paragraph".length,
        anchorText: "Second paragraph",
      });
      const result = reconcileComment(comment, doc.textContent, doc);
      expect(result).toEqual({
        found: true,
        newFrom: located.from,
        newTo: located.to,
        confidence: "fuzzy",
      });
    });

    it("returns exact (no rewrite) when stored position already matches", () => {
      const doc = makePmDoc("Hello world.");
      const located = findAnchorPositionInDoc(doc, "world");
      expect(located).not.toBeNull();
      if (!located) return;

      const comment = makeComment({
        fromOffset: located.from,
        toOffset: located.to,
        anchorText: "world",
      });
      const result = reconcileComment(comment, doc.textContent, doc);
      expect(result).toEqual({ found: true, confidence: "exact" });
    });

    it("tolerates curly vs straight quotes when locating in the doc", () => {
      // Doc has curly quotes; stored anchor has straight ones (LLM emission).
      const doc = makePmDoc("She said “hello” softly.");
      const located = findAnchorPositionInDoc(doc, "said “hello”");
      expect(located).not.toBeNull();
      if (!located) return;

      const comment = makeComment({
        fromOffset: 1,
        toOffset: 1 + 'said "hello"'.length,
        anchorText: 'said "hello"',
      });
      const result = reconcileComment(comment, doc.textContent, doc);
      expect(result).toEqual({
        found: true,
        newFrom: located.from,
        newTo: located.to,
        confidence: "fuzzy",
      });
    });

    it("falls back to plain-text path when the anchor isn't in the doc", () => {
      const doc = makePmDoc("Hello world.");
      const comment = makeComment({
        fromOffset: 1,
        toOffset: 8,
        anchorText: "missing entirely",
      });
      // Doc-aware path can't find it; the plain-text path also fails.
      const result = reconcileComment(comment, doc.textContent, doc);
      expect(result.found).toBe(false);
    });
  });
});

describe("findAnchorPositionInDoc", () => {
  it("returns null for an empty anchor", () => {
    const doc = makePmDoc("Hello");
    expect(findAnchorPositionInDoc(doc, "")).toBeNull();
  });

  it("returns null when the anchor isn't present", () => {
    const doc = makePmDoc("Hello world.");
    expect(findAnchorPositionInDoc(doc, "nope")).toBeNull();
  });

  it("finds an anchor inside a single text node", () => {
    const doc = makePmDoc("Hello world.");
    const located = findAnchorPositionInDoc(doc, "world");
    expect(located).not.toBeNull();
    if (!located) return;
    // The slice `[from, to)` in the PM doc should equal the anchor.
    expect(doc.textBetween(located.from, located.to)).toBe("world");
  });

  it("finds an anchor in the second paragraph", () => {
    const doc = makePmDoc("First.", "Second match here.");
    const located = findAnchorPositionInDoc(doc, "match");
    expect(located).not.toBeNull();
    if (!located) return;
    expect(doc.textBetween(located.from, located.to)).toBe("match");
  });

  it("does not match across block boundaries", () => {
    // The string "First.Second" would match if we concatenated text nodes
    // across blocks; we intentionally don't.
    const doc = makePmDoc("First.", "Second.");
    expect(findAnchorPositionInDoc(doc, "First.Second")).toBeNull();
  });
});
