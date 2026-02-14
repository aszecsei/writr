import { describe, expect, it } from "vitest";
import { getTerm } from "./terminology";

describe("getTerm", () => {
  it("returns prose terms by default", () => {
    expect(getTerm("prose", "chapter")).toBe("Chapter");
    expect(getTerm("prose", "chapters")).toBe("Chapters");
    expect(getTerm("prose", "addChapter")).toBe("Add Chapter");
    expect(getTerm("prose", "untitledChapter")).toBe("Untitled Chapter");
    expect(getTerm("prose", "book")).toBe("Book");
    expect(getTerm("prose", "entireBook")).toBe("Entire Book");
    expect(getTerm("prose", "currentChapter")).toBe("Current Chapter");
  });

  it("returns screenplay terms", () => {
    expect(getTerm("screenplay", "chapter")).toBe("Sequence");
    expect(getTerm("screenplay", "chapters")).toBe("Sequences");
    expect(getTerm("screenplay", "addChapter")).toBe("Add Sequence");
    expect(getTerm("screenplay", "untitledChapter")).toBe("Untitled Sequence");
    expect(getTerm("screenplay", "book")).toBe("Screenplay");
    expect(getTerm("screenplay", "entireBook")).toBe("Entire Screenplay");
    expect(getTerm("screenplay", "currentChapter")).toBe("Current Sequence");
  });

  it("falls back to prose when mode is null", () => {
    expect(getTerm(null, "chapter")).toBe("Chapter");
    expect(getTerm(null, "book")).toBe("Book");
  });
});
