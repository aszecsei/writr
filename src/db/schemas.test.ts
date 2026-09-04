import { describe, expect, it } from "vitest";
import { isSupportedImageSource, ProjectSchema } from "./schemas";

describe("isSupportedImageSource", () => {
  it.each([
    ["the empty string (no image)", ""],
    ["an https URL", "https://example.com/cover.jpg"],
    ["an http URL", "http://example.com/cover.jpg"],
    ["a png data URL", "data:image/png;base64,iVBORw0KGgo="],
    ["a webp data URL", "data:image/webp;base64,UklGRg=="],
    ["an svg+xml data URL", "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="],
  ])("accepts %s", (_label, value) => {
    expect(isSupportedImageSource(value)).toBe(true);
  });

  it.each([
    ["a javascript: URL", "javascript:alert(1)"],
    ["a blob: URL", "blob:https://example.com/abc-123"],
    ["an ftp URL", "ftp://example.com/cover.jpg"],
    ["a non-image data URL", "data:text/html;base64,PHNjcmlwdD4="],
    ["a non-base64 image data URL", "data:image/svg+xml,<svg></svg>"],
    ["a bare filename", "cover.jpg"],
    ["a protocol-relative URL", "//example.com/cover.jpg"],
    ["whitespace", "   "],
  ])("rejects %s", (_label, value) => {
    expect(isSupportedImageSource(value)).toBe(false);
  });
});

describe("ProjectSchema.coverImageUrl", () => {
  const base = {
    id: crypto.randomUUID(),
    title: "A Project",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("rejects an unsupported cover source", () => {
    expect(() =>
      ProjectSchema.parse({ ...base, coverImageUrl: "javascript:alert(1)" }),
    ).toThrow();
  });
});
