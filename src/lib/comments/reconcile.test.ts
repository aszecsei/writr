import { describe, expect, it } from "vitest";
import type { Comment } from "@/db/schemas";
import { reconcileComment } from "./reconcile";

const ts = "2024-01-01T00:00:00.000Z";

function makeComment(overrides: Partial<Comment>): Comment {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    projectId: "00000000-0000-4000-8000-000000000010",
    chapterId: "00000000-0000-4000-8000-000000000020",
    content: "test comment",
    color: "yellow",
    fromOffset: 5,
    toOffset: 5,
    anchorText: "",
    status: "active",
    resolvedAt: null,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
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

    it("returns fuzzy with clamped position when past end", () => {
      const text = "Hi";
      const comment = makeComment({
        fromOffset: 100,
        toOffset: 100,
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

    it("returns fuzzy with clamped positions when bounds exceeded", () => {
      const text = "Hi";
      const comment = makeComment({
        fromOffset: 50,
        toOffset: 100,
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
});
