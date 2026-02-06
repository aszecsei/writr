import { describe, expect, it } from "vitest";
import { shouldSkipWord, tokenizeText } from "./tokenizer";

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
      const tokens = tokenizeText("don't won't", 0);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].word).toBe("don't");
      expect(tokens[1].word).toBe("won't");
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

    it("should skip numbers", () => {
      const tokens = tokenizeText("hello 123 world", 0);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].word).toBe("hello");
      expect(tokens[1].word).toBe("world");
    });

    it("should handle mixed text and numbers", () => {
      // "chapter1" contains "chapter" which is extracted as a word
      const tokens = tokenizeText("chapter1 word", 0);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].word).toBe("chapter");
      expect(tokens[1].word).toBe("word");
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
});
