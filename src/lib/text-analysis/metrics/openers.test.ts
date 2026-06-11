import { describe, expect, it } from "vitest";
import type { AnalyzedTerm } from "../types";
import { openerCategory } from "./openers";

function term(normal: string, ...tags: string[]): AnalyzedTerm {
  return { normal, tags: new Set(tags), syllables: 1 };
}

describe("openerCategory", () => {
  it("prefers closed-class tags over open-class tags", () => {
    expect(openerCategory(term("but", "Conjunction", "Verb"))).toBe(
      "conjunction",
    );
    expect(openerCategory(term("the", "Determiner"))).toBe("determiner");
    expect(openerCategory(term("she", "Noun", "Pronoun"))).toBe("pronoun");
    expect(openerCategory(term("with", "Preposition"))).toBe("preposition");
  });

  it("ranks proper nouns above plain nouns", () => {
    expect(
      openerCategory(term("john", "Noun", "ProperNoun", "FirstName")),
    ).toBe("properNoun");
    expect(openerCategory(term("dog", "Noun", "Singular"))).toBe("noun");
  });

  it("categorizes verbs, adverbs, adjectives and numbers", () => {
    expect(openerCategory(term("running", "Verb", "Gerund"))).toBe("verb");
    expect(openerCategory(term("slowly", "Adverb"))).toBe("adverb");
    expect(openerCategory(term("cold", "Adjective"))).toBe("adjective");
    expect(openerCategory(term("42", "Value", "NumericValue"))).toBe("number");
  });

  it("overrides open-class mis-tags with closed-class word lists", () => {
    // compromise tags "under" as Adjective even in prepositional use.
    expect(openerCategory(term("under", "Adjective"))).toBe("preposition");
    expect(openerCategory(term("that", "Adjective"))).toBe("determiner");
  });

  it("does not override a confident closed-class tag", () => {
    // "that" tagged Pronoun stays a pronoun despite being in the
    // conjunction and determiner lists too.
    expect(openerCategory(term("that", "Pronoun"))).toBe("pronoun");
  });

  it("falls back to other for untagged terms", () => {
    expect(openerCategory(term("hmm"))).toBe("other");
  });
});
