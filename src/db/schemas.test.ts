import { describe, expect, it } from "vitest";
import {
  IndexedChunkSchema,
  isSupportedImageSource,
  ProjectSchema,
} from "./schemas";

describe("IndexedChunkSchema", () => {
  it("parses a valid row", () => {
    const row = IndexedChunkSchema.parse({
      id: crypto.randomUUID(),
      projectId: crypto.randomUUID(),
      sourceType: "worldbuilding",
      sourceId: crypto.randomUUID(),
      chunkIndex: 0,
      text: "lore",
      contentHash: "deadbeef",
      vector: [0.1, 0.2],
      embeddingModel: "fake-v1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(row.sourceType).toBe("worldbuilding");
  });
});

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

  it("defaults to the empty string on a legacy-shaped project", () => {
    expect(ProjectSchema.parse(base).coverImageUrl).toBe("");
  });

  it("preserves a data URL cover", () => {
    const coverImageUrl = "data:image/png;base64,iVBORw0KGgo=";
    expect(ProjectSchema.parse({ ...base, coverImageUrl }).coverImageUrl).toBe(
      coverImageUrl,
    );
  });

  it("rejects an unsupported cover source", () => {
    expect(() =>
      ProjectSchema.parse({ ...base, coverImageUrl: "javascript:alert(1)" }),
    ).toThrow();
  });
});
