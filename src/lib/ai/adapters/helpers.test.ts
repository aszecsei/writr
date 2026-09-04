import { describe, expect, it } from "vitest";
import { extractTextContent } from "./helpers";

describe("extractTextContent", () => {
  it("passes a plain string through with no cache marker", () => {
    expect(extractTextContent("hello")).toEqual({ text: "hello" });
  });

  it("concatenates text parts", () => {
    expect(
      extractTextContent([
        { type: "text", text: "Part 1 " },
        { type: "text", text: "Part 2" },
      ]),
    ).toEqual({ text: "Part 1 Part 2" });
  });

  it("surfaces the first cache_control found on a text part", () => {
    expect(
      extractTextContent([
        { type: "text", text: "cached" },
        {
          type: "text",
          text: " more",
          cache_control: { type: "ephemeral" },
        },
      ]),
    ).toEqual({ text: "cached more", cacheControl: { type: "ephemeral" } });
  });

  it("skips image parts when concatenating text", () => {
    expect(
      extractTextContent([
        { type: "text", text: "before " },
        { type: "image_url", image_url: { url: "https://example.com/x.png" } },
        { type: "text", text: "after" },
      ]),
    ).toEqual({ text: "before after" });
  });
});
