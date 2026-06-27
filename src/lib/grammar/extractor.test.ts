import { getSchema } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { createExtensions } from "@/components/editor/extensions";
import { extractBlocks, mapSpanToRange } from "./extractor";

const schema = getSchema(createExtensions());

// biome-ignore lint/suspicious/noExplicitAny: test fixture JSON is intentionally loose
function docFromJSON(content: any[]): ProseMirrorNode {
  return schema.nodeFromJSON({ type: "doc", content });
}

function expectRange(range: { from: number; to: number } | null): {
  from: number;
  to: number;
} {
  if (!range) throw new Error("expected a non-null range");
  return range;
}

describe("extractBlocks", () => {
  it("extracts a paragraph's text with code-unit-accurate positions", () => {
    const doc = docFromJSON([
      { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
    ]);

    const blocks = extractBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("Hello world");
    // Paragraph content starts at PM position 1.
    expect(blocks[0].offsets[0]).toBe(1);
    expect(blocks[0].offsets).toHaveLength("Hello world".length);

    // A span over "world" should map to the PM range that textBetween confirms.
    const start = "Hello world".indexOf("world");
    const end = start + "world".length;
    const range = expectRange(mapSpanToRange(blocks[0], start, end));
    expect(doc.textBetween(range.from, range.to)).toBe("world");
  });

  it("concatenates adjacent text nodes across mark boundaries", () => {
    // "an " followed by a bolded "apple" — a single logical sentence split
    // into two text nodes. Grammar checking needs them joined.
    const doc = docFromJSON([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "an " },
          { type: "text", text: "apple", marks: [{ type: "bold" }] },
        ],
      },
    ]);

    const blocks = extractBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("an apple");

    const start = "an apple".indexOf("apple");
    const range = expectRange(
      mapSpanToRange(blocks[0], start, start + "apple".length),
    );
    expect(doc.textBetween(range.from, range.to)).toBe("apple");
  });

  it("skips code blocks but still maps later paragraphs correctly", () => {
    const doc = docFromJSON([
      { type: "codeBlock", content: [{ type: "text", text: "const x = 1;" }] },
      { type: "paragraph", content: [{ type: "text", text: "Real prose." }] },
    ]);

    const blocks = extractBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("Real prose.");

    const start = "Real prose.".indexOf("prose");
    const range = expectRange(
      mapSpanToRange(blocks[0], start, start + "prose".length),
    );
    expect(doc.textBetween(range.from, range.to)).toBe("prose");
  });

  it("excludes inline code content while preserving a word boundary", () => {
    const doc = docFromJSON([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "run " },
          { type: "text", text: "foo", marks: [{ type: "code" }] },
          { type: "text", text: " now" },
        ],
      },
    ]);

    const blocks = extractBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).not.toContain("foo");
    // "run" and "now" must not be glued together.
    expect(blocks[0].text).toMatch(/run\s+now/);
  });

  it("produces one block per textblock", () => {
    const doc = docFromJSON([
      { type: "paragraph", content: [{ type: "text", text: "First." }] },
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Title" }],
      },
      { type: "paragraph", content: [{ type: "text", text: "Second." }] },
    ]);

    const blocks = extractBlocks(doc);
    expect(blocks.map((b) => b.text)).toEqual(["First.", "Title", "Second."]);
  });
});

describe("mapSpanToRange", () => {
  const block = { text: "abc", offsets: [1, 2, 3] };

  it("returns null for empty spans", () => {
    expect(mapSpanToRange(block, 1, 1)).toBeNull();
  });

  it("returns null for out-of-range spans", () => {
    expect(mapSpanToRange(block, 0, 4)).toBeNull();
    expect(mapSpanToRange(block, -1, 2)).toBeNull();
  });

  it("maps a valid span to inclusive-start, exclusive-end PM positions", () => {
    expect(mapSpanToRange(block, 0, 2)).toEqual({ from: 1, to: 3 });
  });
});
