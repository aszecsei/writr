import { describe, expect, it } from "vitest";
import { exportHtml, nodesToHtml } from "./exportHtml";
import type { DocNode } from "./markdown-to-nodes";

describe("nodesToHtml", () => {
  describe("block-level elements", () => {
    it("converts a paragraph", () => {
      const nodes: DocNode[] = [
        { type: "paragraph", spans: [{ text: "Hello world", styles: [] }] },
      ];
      expect(nodesToHtml(nodes)).toBe("<p>Hello world</p>");
    });

    it("converts headings h1 through h6", () => {
      for (let level = 1; level <= 6; level++) {
        const nodes: DocNode[] = [
          {
            type: "heading",
            level: level as 1 | 2 | 3 | 4 | 5 | 6,
            spans: [{ text: `Heading ${level}`, styles: [] }],
          },
        ];
        expect(nodesToHtml(nodes)).toBe(
          `<h${level}>Heading ${level}</h${level}>`,
        );
      }
    });

    it("converts a code block", () => {
      const nodes: DocNode[] = [{ type: "code", text: "const x = 1;" }];
      expect(nodesToHtml(nodes)).toBe("<pre><code>const x = 1;</code></pre>");
    });

    it("converts a horizontal rule", () => {
      const nodes: DocNode[] = [{ type: "hr" }];
      expect(nodesToHtml(nodes)).toBe("<hr>");
    });

    it("converts a page break to hr", () => {
      const nodes: DocNode[] = [{ type: "pageBreak" }];
      expect(nodesToHtml(nodes)).toBe("<hr>");
    });

    it("converts a blockquote", () => {
      const nodes: DocNode[] = [
        {
          type: "blockquote",
          children: [
            { type: "paragraph", spans: [{ text: "quoted text", styles: [] }] },
          ],
        },
      ];
      expect(nodesToHtml(nodes)).toBe(
        "<blockquote>\n<p>quoted text</p>\n</blockquote>",
      );
    });

    it("converts an unordered list", () => {
      const nodes: DocNode[] = [
        {
          type: "list",
          ordered: false,
          items: [
            [{ type: "paragraph", spans: [{ text: "one", styles: [] }] }],
            [{ type: "paragraph", spans: [{ text: "two", styles: [] }] }],
          ],
        },
      ];
      expect(nodesToHtml(nodes)).toBe(
        "<ul>\n<li><p>one</p></li>\n<li><p>two</p></li>\n</ul>",
      );
    });

    it("converts an ordered list", () => {
      const nodes: DocNode[] = [
        {
          type: "list",
          ordered: true,
          items: [
            [{ type: "paragraph", spans: [{ text: "first", styles: [] }] }],
            [{ type: "paragraph", spans: [{ text: "second", styles: [] }] }],
          ],
        },
      ];
      expect(nodesToHtml(nodes)).toBe(
        "<ol>\n<li><p>first</p></li>\n<li><p>second</p></li>\n</ol>",
      );
    });
  });

  describe("inline styles", () => {
    it("converts bold text", () => {
      const nodes: DocNode[] = [
        { type: "paragraph", spans: [{ text: "bold", styles: ["bold"] }] },
      ];
      expect(nodesToHtml(nodes)).toBe("<p><strong>bold</strong></p>");
    });

    it("converts italic text", () => {
      const nodes: DocNode[] = [
        { type: "paragraph", spans: [{ text: "italic", styles: ["italic"] }] },
      ];
      expect(nodesToHtml(nodes)).toBe("<p><em>italic</em></p>");
    });

    it("converts inline code", () => {
      const nodes: DocNode[] = [
        { type: "paragraph", spans: [{ text: "code", styles: ["code"] }] },
      ];
      expect(nodesToHtml(nodes)).toBe("<p><code>code</code></p>");
    });

    it("converts strikethrough", () => {
      const nodes: DocNode[] = [
        {
          type: "paragraph",
          spans: [{ text: "struck", styles: ["strikethrough"] }],
        },
      ];
      expect(nodesToHtml(nodes)).toBe("<p><s>struck</s></p>");
    });

    it("converts nested bold and italic", () => {
      const nodes: DocNode[] = [
        {
          type: "paragraph",
          spans: [{ text: "both", styles: ["bold", "italic"] }],
        },
      ];
      expect(nodesToHtml(nodes)).toBe("<p><strong><em>both</em></strong></p>");
    });

    it("converts multiple spans", () => {
      const nodes: DocNode[] = [
        {
          type: "paragraph",
          spans: [
            { text: "plain ", styles: [] },
            { text: "bold", styles: ["bold"] },
            { text: " plain", styles: [] },
          ],
        },
      ];
      expect(nodesToHtml(nodes)).toBe(
        "<p>plain <strong>bold</strong> plain</p>",
      );
    });
  });

  describe("HTML escaping", () => {
    it("escapes special characters in text", () => {
      const nodes: DocNode[] = [
        {
          type: "paragraph",
          spans: [{ text: '<script>alert("xss")</script>', styles: [] }],
        },
      ];
      expect(nodesToHtml(nodes)).toBe(
        "<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>",
      );
    });

    it("escapes ampersands", () => {
      const nodes: DocNode[] = [
        {
          type: "paragraph",
          spans: [{ text: "Tom & Jerry", styles: [] }],
        },
      ];
      expect(nodesToHtml(nodes)).toBe("<p>Tom &amp; Jerry</p>");
    });

    it("escapes code block content", () => {
      const nodes: DocNode[] = [{ type: "code", text: "if (a < b && c > d)" }];
      expect(nodesToHtml(nodes)).toBe(
        "<pre><code>if (a &lt; b &amp;&amp; c &gt; d)</code></pre>",
      );
    });
  });
});

describe("exportHtml", () => {
  it("exports a single chapter without heading", () => {
    const content = {
      projectTitle: "My Book",
      chapters: [{ title: "Chapter 1", content: "Hello **world**" }],
    };
    const html = exportHtml(content, {
      format: "markdown",
      scope: "chapter",
      projectId: "test",
      includeTitlePage: false,
      includeChapterHeadings: false,
      pageBreaksBetweenChapters: false,
    });
    expect(html).toBe("<p>Hello <strong>world</strong></p>");
  });

  it("exports a single chapter with heading", () => {
    const content = {
      projectTitle: "My Book",
      chapters: [{ title: "Chapter 1", content: "Content here" }],
    };
    const html = exportHtml(content, {
      format: "markdown",
      scope: "chapter",
      projectId: "test",
      includeTitlePage: false,
      includeChapterHeadings: true,
      pageBreaksBetweenChapters: false,
    });
    expect(html).toBe("<h2>Chapter 1</h2>\n\n<p>Content here</p>");
  });

  it("exports entire book with title page", () => {
    const content = {
      projectTitle: "My Book",
      chapters: [
        { title: "Chapter 1", content: "First" },
        { title: "Chapter 2", content: "Second" },
      ],
    };
    const html = exportHtml(content, {
      format: "markdown",
      scope: "book",
      projectId: "test",
      includeTitlePage: true,
      includeChapterHeadings: true,
      pageBreaksBetweenChapters: false,
    });
    expect(html).toContain("<h1>My Book</h1>");
    expect(html).toContain("<h2>Chapter 1</h2>");
    expect(html).toContain("<h2>Chapter 2</h2>");
  });

  it("escapes title page content", () => {
    const content = {
      projectTitle: "Tom & Jerry's <Adventure>",
      chapters: [{ title: "Chapter 1", content: "Test" }],
    };
    const html = exportHtml(content, {
      format: "markdown",
      scope: "book",
      projectId: "test",
      includeTitlePage: true,
      includeChapterHeadings: false,
      pageBreaksBetweenChapters: false,
    });
    expect(html).toContain("<h1>Tom &amp; Jerry's &lt;Adventure&gt;</h1>");
  });
});
