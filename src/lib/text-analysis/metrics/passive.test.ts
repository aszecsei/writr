import { describe, expect, it } from "vitest";
import { sentence, term } from "../test-helpers";
import { isPassiveSentence } from "./passive";

describe("isPassiveSentence", () => {
  it("detects passive voice via the compromise Passive tag or the be + past-participle fallback", () => {
    expect(
      isPassiveSentence(
        sentence([
          term("the", "Determiner"),
          term("ball", "Noun"),
          term("was", "Verb", "Copula", "Passive"),
          term("thrown", "Verb", "PastTense", "Participle", "Passive"),
        ]),
      ),
    ).toBe(true);

    expect(
      isPassiveSentence(
        sentence([
          term("mistakes", "Noun", "Plural"),
          term("were", "Verb", "Copula"),
          term("made", "Verb", "PastTense"),
        ]),
      ),
    ).toBe(true);
  });

  it("allows one intervening adverb", () => {
    expect(
      isPassiveSentence(
        sentence([
          term("it", "Pronoun"),
          term("was", "Verb", "Copula"),
          term("quickly", "Adverb"),
          term("eaten", "Verb", "PastTense", "Participle"),
        ]),
      ),
    ).toBe(true);
  });

  it("does not flag progressive aspect", () => {
    expect(
      isPassiveSentence(
        sentence([
          term("she", "Pronoun"),
          term("was", "Verb", "Copula"),
          term("running", "Verb", "PresentTense", "Gerund"),
        ]),
      ),
    ).toBe(false);
  });

  it("does not flag active past tense", () => {
    expect(
      isPassiveSentence(
        sentence([
          term("john", "Noun", "ProperNoun"),
          term("threw", "Verb", "PastTense"),
          term("the", "Determiner"),
          term("ball", "Noun"),
        ]),
      ),
    ).toBe(false);
  });

  it("does not flag a be-form followed by a predicate adjective", () => {
    expect(
      isPassiveSentence(
        sentence([
          term("she", "Pronoun"),
          term("was", "Verb", "Copula"),
          term("tired", "Adjective"),
        ]),
      ),
    ).toBe(false);
  });
});
