import { getSchema } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { createExtensions } from "@/components/editor/extensions";
import { extractWords, shouldSkipWord, tokenizeText } from "./tokenizer";

const schema = getSchema(createExtensions());

// biome-ignore lint/suspicious/noExplicitAny: test fixture JSON is intentionally loose
function docFromJSON(content: any[]): ProseMirrorNode {
  return schema.nodeFromJSON({ type: "doc", content });
}

describe("tokenizer", () => {
  describe("tokenizeText", () => {
    it("should extract simple words", () => {
      const tokens = tokenizeText("hello world", 0);
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toEqual({ word: "hello", from: 0, to: 5 });
      expect(tokens[1]).toEqual({ word: "world", from: 6, to: 11 });
    });

    it("should handle startPos offset", () => {
      const tokens = tokenizeText("hello", 100);
      expect(tokens[0]).toEqual({ word: "hello", from: 100, to: 105 });
    });

    it("should extract contractions as single words, normalizing any apostrophe variant", () => {
      // ' (ASCII), ’ (curly), ‘ (left single quote), ʼ (modifier letter apostrophe)
      const tokens = tokenizeText("don't won’t wouldn‘t couldʼve", 0);
      expect(tokens.map((t) => t.word)).toEqual([
        "don't",
        "won't",
        "wouldn't",
        "could've",
      ]);
    });

    it("should strip punctuation from word boundaries, including quotes", () => {
      const tokens = tokenizeText('hello, world! "quoted" text', 0);
      expect(tokens.map((t) => t.word)).toEqual([
        "hello",
        "world",
        "quoted",
        "text",
      ]);
    });

    it("should skip single character words", () => {
      const tokens = tokenizeText("I a hello", 0);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].word).toBe("hello");
    });

    it("should handle Unicode letters", () => {
      const tokens = tokenizeText("café naïve", 0);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].word).toBe("café");
      expect(tokens[1].word).toBe("naïve");
    });

    it("should split on em dashes and ellipsis", () => {
      expect(tokenizeText("hello—world", 0).map((t) => t.word)).toEqual([
        "hello",
        "world",
      ]);
      expect(tokenizeText("hello... world", 0).map((t) => t.word)).toEqual([
        "hello",
        "world",
      ]);
    });

    it("should return empty array for empty or punctuation-only text", () => {
      expect(tokenizeText("", 0)).toHaveLength(0);
      expect(tokenizeText("...!!??", 0)).toHaveLength(0);
    });
  });

  describe("shouldSkipWord", () => {
    it("should skip all-caps abbreviations up to 5 chars but not longer", () => {
      expect(shouldSkipWord("NASA")).toBe(true);
      expect(shouldSkipWord("SOMET")).toBe(true);
      expect(shouldSkipWord("SOMETH")).toBe(false);
    });

    it("should skip ordinals", () => {
      expect(shouldSkipWord("1st")).toBe(true);
      expect(shouldSkipWord("21st")).toBe(true);
    });

    it("should not skip regular words", () => {
      expect(shouldSkipWord("hello")).toBe(false);
      expect(shouldSkipWord("World")).toBe(false);
    });
  });

  describe("extractWords", () => {
    it("skips text carrying an inline code mark while tokenizing adjacent text", () => {
      const doc = docFromJSON([
        {
          type: "paragraph",
          content: [
            { type: "text", text: "run " },
            { type: "text", text: "fooBarBaz", marks: [{ type: "code" }] },
            { type: "text", text: " now" },
          ],
        },
      ]);

      const words = extractWords(doc).map((token) => token.word);
      expect(words).toEqual(["run", "now"]);
    });

    it("skips code blocks entirely", () => {
      const doc = docFromJSON([
        {
          type: "codeBlock",
          content: [{ type: "text", text: "const x = 1;" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "Real prose." }] },
      ]);

      const words = extractWords(doc).map((token) => token.word);
      expect(words).toEqual(["Real", "prose"]);
    });
  });
});
