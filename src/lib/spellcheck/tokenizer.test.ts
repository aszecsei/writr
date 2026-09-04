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

    it("should extract contractions as single words", () => {
      const tokens = tokenizeText("don't won't can't", 0);
      expect(tokens).toHaveLength(3);
      expect(tokens[0].word).toBe("don't");
      expect(tokens[1].word).toBe("won't");
      expect(tokens[2].word).toBe("can't");
    });

    it("should handle smart quotes in contractions", () => {
      const tokens = tokenizeText("don\u2019t won\u2019t", 0);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].word).toBe("don't");
      expect(tokens[1].word).toBe("won't");
    });

    it("should normalize all apostrophe variants in contractions", () => {
      // U+2018 LEFT SINGLE QUOTATION MARK, U+02BC MODIFIER LETTER APOSTROPHE
      const tokens = tokenizeText("wouldn\u2018t could\u02BCve", 0);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].word).toBe("wouldn't");
      expect(tokens[1].word).toBe("could've");
    });

    it("should strip punctuation from word boundaries", () => {
      const tokens = tokenizeText("hello, world!", 0);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].word).toBe("hello");
      expect(tokens[1].word).toBe("world");
    });

    it("should handle quoted words", () => {
      const tokens = tokenizeText('"hello" world', 0);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].word).toBe("hello");
      expect(tokens[1].word).toBe("world");
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

    it("should handle em dashes", () => {
      const tokens = tokenizeText("hello—world", 0);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].word).toBe("hello");
      expect(tokens[1].word).toBe("world");
    });

    it("should handle ellipsis", () => {
      const tokens = tokenizeText("hello... world", 0);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].word).toBe("hello");
      expect(tokens[1].word).toBe("world");
    });

    it("should return empty array for empty text", () => {
      const tokens = tokenizeText("", 0);
      expect(tokens).toHaveLength(0);
    });

    it("should return empty array for text with only punctuation", () => {
      const tokens = tokenizeText("...!!??", 0);
      expect(tokens).toHaveLength(0);
    });
  });

  describe("shouldSkipWord", () => {
    it("should skip short all-caps abbreviations", () => {
      expect(shouldSkipWord("NASA")).toBe(true);
      expect(shouldSkipWord("FBI")).toBe(true);
      expect(shouldSkipWord("USA")).toBe(true);
    });

    it("should not skip longer all-caps words", () => {
      expect(shouldSkipWord("SOMETHING")).toBe(false);
    });

    it("should skip ordinals", () => {
      expect(shouldSkipWord("1st")).toBe(true);
      expect(shouldSkipWord("2nd")).toBe(true);
      expect(shouldSkipWord("3rd")).toBe(true);
      expect(shouldSkipWord("4th")).toBe(true);
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
