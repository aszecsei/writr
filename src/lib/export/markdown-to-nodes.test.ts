import { describe, expect, it } from "vitest";
import { type DocNode, markdownToNodes } from "./markdown-to-nodes";

describe("markdownToNodes", () => {
  describe("block-level elements", () => {
    it("returns empty array for empty input", () => {
      expect(markdownToNodes("")).toEqual([]);
    });

    it("returns empty array for whitespace-only input", () => {
      expect(markdownToNodes("   \n\n  \n")).toEqual([]);
    });

    it("parses a paragraph", () => {
      const nodes = markdownToNodes("Hello world");
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: "paragraph",
        spans: [{ text: "Hello world", styles: [] }],
      });
    });

    it("parses headings h1 through h6", () => {
      for (let level = 1; level <= 6; level++) {
        const md = `${"#".repeat(level)} Heading ${level}`;
        const nodes = markdownToNodes(md);
        expect(nodes).toHaveLength(1);
        expect(nodes[0]).toMatchObject({
          type: "heading",
          level,
          spans: [{ text: `Heading ${level}`, styles: [] }],
        });
      }
    });

    it("parses a code block", () => {
      const md = "```\nconst x = 1;\n```";
      const nodes = markdownToNodes(md);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: "code",
        text: "const x = 1;",
      });
    });

    it("parses a horizontal rule", () => {
      const nodes = markdownToNodes("---");
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({ type: "hr" });
    });

    it("parses a Writr scene-break marker as an hr", () => {
      const nodes = markdownToNodes(
        'Before.\n\n<hr data-type="sceneBreak" data-scene-id="abc-123">\n\nAfter.',
      );
      expect(nodes.map((n) => n.type)).toEqual([
        "paragraph",
        "hr",
        "paragraph",
      ]);
    });

    it("parses a bare inline <hr> as an hr", () => {
      const nodes = markdownToNodes("Before.\n\n<hr>\n\nAfter.");
      expect(nodes.map((n) => n.type)).toEqual([
        "paragraph",
        "hr",
        "paragraph",
      ]);
    });

    it("parses a blockquote", () => {
      const nodes = markdownToNodes("> quoted text");
      expect(nodes).toHaveLength(1);
      const bq = nodes[0] as Extract<DocNode, { type: "blockquote" }>;
      expect(bq.type).toBe("blockquote");
      expect(bq.children).toHaveLength(1);
      expect(bq.children[0]).toMatchObject({
        type: "paragraph",
        spans: [{ text: "quoted text", styles: [] }],
      });
    });

    it("parses nested blockquotes", () => {
      const nodes = markdownToNodes("> outer\n>> inner");
      expect(nodes).toHaveLength(1);
      const outer = nodes[0] as Extract<DocNode, { type: "blockquote" }>;
      expect(outer.type).toBe("blockquote");
      const inner = outer.children.find(
        (c) => c.type === "blockquote",
      ) as Extract<DocNode, { type: "blockquote" }>;
      expect(inner).toBeDefined();
    });

    it("parses an unordered list", () => {
      const md = "- one\n- two\n- three";
      const nodes = markdownToNodes(md);
      expect(nodes).toHaveLength(1);
      const list = nodes[0] as Extract<DocNode, { type: "list" }>;
      expect(list.type).toBe("list");
      expect(list.ordered).toBe(false);
      expect(list.items).toHaveLength(3);
    });

    it("parses an ordered list", () => {
      const md = "1. first\n2. second";
      const nodes = markdownToNodes(md);
      expect(nodes).toHaveLength(1);
      const list = nodes[0] as Extract<DocNode, { type: "list" }>;
      expect(list.type).toBe("list");
      expect(list.ordered).toBe(true);
      expect(list.items).toHaveLength(2);
    });

    it("parses a mixed block sequence", () => {
      const md = "# Title\n\nParagraph\n\n- item\n\n---\n\n> quote";
      const nodes = markdownToNodes(md);
      const types = nodes.map((n) => n.type);
      expect(types).toEqual([
        "heading",
        "paragraph",
        "list",
        "hr",
        "blockquote",
      ]);
    });
  });

  describe("inline styles", () => {
    it("parses bold text", () => {
      const nodes = markdownToNodes("**bold**");
      const spans = (nodes[0] as Extract<DocNode, { type: "paragraph" }>).spans;
      expect(spans).toEqual([{ type: "text", text: "bold", styles: ["bold"] }]);
    });

    it("parses italic text", () => {
      const nodes = markdownToNodes("*italic*");
      const spans = (nodes[0] as Extract<DocNode, { type: "paragraph" }>).spans;
      expect(spans).toEqual([
        { type: "text", text: "italic", styles: ["italic"] },
      ]);
    });

    it("parses inline code", () => {
      const nodes = markdownToNodes("`code`");
      const spans = (nodes[0] as Extract<DocNode, { type: "paragraph" }>).spans;
      expect(spans).toEqual([{ type: "text", text: "code", styles: ["code"] }]);
    });

    it("parses strikethrough", () => {
      const nodes = markdownToNodes("~~struck~~");
      const spans = (nodes[0] as Extract<DocNode, { type: "paragraph" }>).spans;
      expect(spans).toEqual([
        { type: "text", text: "struck", styles: ["strikethrough"] },
      ]);
    });

    it("parses bold inside italic", () => {
      const nodes = markdownToNodes("*outer **inner** outer*");
      const spans = (nodes[0] as Extract<DocNode, { type: "paragraph" }>).spans;
      expect(spans).toHaveLength(3);
      expect(spans[0]).toMatchObject({ text: "outer ", styles: ["italic"] });
      expect(spans[1]).toMatchObject({
        text: "inner",
        styles: ["italic", "bold"],
      });
      expect(spans[2]).toMatchObject({ text: " outer", styles: ["italic"] });
    });

    it("parses code inside bold", () => {
      const nodes = markdownToNodes("**`code`**");
      const spans = (nodes[0] as Extract<DocNode, { type: "paragraph" }>).spans;
      expect(spans).toEqual([
        { type: "text", text: "code", styles: ["bold", "code"] },
      ]);
    });

    it("parses triple-nested bold italic (***text***)", () => {
      const nodes = markdownToNodes("***bold italic***");
      const spans = (nodes[0] as Extract<DocNode, { type: "paragraph" }>).spans;
      expect(spans).toHaveLength(1);
      const span = spans[0];
      if (span.type !== "text") throw new Error("expected text span");
      expect(span.text).toBe("bold italic");
      expect(span.styles).toContain("bold");
      expect(span.styles).toContain("italic");
    });

    it("extracts text from links", () => {
      const nodes = markdownToNodes("[click here](https://example.com)");
      const spans = (nodes[0] as Extract<DocNode, { type: "paragraph" }>).spans;
      expect(spans).toEqual([{ type: "text", text: "click here", styles: [] }]);
    });

    it("extracts alt text from images", () => {
      const nodes = markdownToNodes("![alt text](image.png)");
      const spans = (nodes[0] as Extract<DocNode, { type: "paragraph" }>).spans;
      const span = spans[0];
      if (span.type !== "text") throw new Error("expected text span");
      expect(span.text).toBe("alt text");
    });

    it("uses [image] fallback when no alt text", () => {
      const nodes = markdownToNodes("![](image.png)");
      const spans = (nodes[0] as Extract<DocNode, { type: "paragraph" }>).spans;
      const span = spans[0];
      if (span.type !== "text") throw new Error("expected text span");
      expect(span.text).toBe("[image]");
    });

    it("parses escape sequences", () => {
      const nodes = markdownToNodes("\\*not italic\\*");
      const spans = (nodes[0] as Extract<DocNode, { type: "paragraph" }>).spans;
      const text = spans.map((s) => (s.type === "text" ? s.text : "")).join("");
      expect(text).toBe("*not italic*");
    });

    it("parses two-space hard breaks as lineBreak spans", () => {
      const nodes = markdownToNodes("line one  \nline two");
      const spans = (nodes[0] as Extract<DocNode, { type: "paragraph" }>).spans;
      expect(spans).toEqual([
        { type: "text", text: "line one", styles: [] },
        { type: "lineBreak" },
        { type: "text", text: "line two", styles: [] },
      ]);
    });

    it("parses backslash hard breaks (tiptap-markdown form) as lineBreak spans", () => {
      const nodes = markdownToNodes("line one\\\nline two");
      const spans = (nodes[0] as Extract<DocNode, { type: "paragraph" }>).spans;
      expect(spans.some((s) => s.type === "lineBreak")).toBe(true);
    });
  });
});
