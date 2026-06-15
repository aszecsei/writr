import { describe, expect, it } from "vitest";
import type { Character, Location } from "@/db/schemas";
import { findMentionedEntityIds } from "./entities";

const ch = (id: string, name: string) => ({ id, name }) as unknown as Character;
const loc = (id: string, name: string) => ({ id, name }) as unknown as Location;

describe("findMentionedEntityIds", () => {
  it("matches names case-insensitively on word boundaries", () => {
    const text = "Then MEDIBUND smiled at lord Engelmort.";
    const result = findMentionedEntityIds(
      text,
      [ch("c1", "Medibund"), ch("c2", "Engelmort"), ch("c3", "Brann")],
      [],
    );
    expect(result.characterIds).toEqual(new Set(["c1", "c2"]));
  });

  it("does not match substrings inside other words", () => {
    const result = findMentionedEntityIds(
      "The cattle grazed.",
      [ch("c1", "Cat")],
      [],
    );
    expect(result.characterIds.size).toBe(0);
  });

  it("ignores names shorter than 3 chars", () => {
    const result = findMentionedEntityIds(
      "Jo went home.",
      [ch("c1", "Jo")],
      [],
    );
    expect(result.characterIds.size).toBe(0);
  });

  it("matches locations too", () => {
    const result = findMentionedEntityIds(
      "They reached Highgarden by dusk.",
      [],
      [loc("l1", "Highgarden")],
    );
    expect(result.locationIds).toEqual(new Set(["l1"]));
  });
});
