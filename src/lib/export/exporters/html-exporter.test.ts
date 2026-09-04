import { describe, expect, it } from "vitest";
import { opts } from "../test-helpers";
import { buildExport } from "../visitor";
import { HtmlExporter } from "./html-exporter";

function renderChapter(
  content: string,
  overrides: Partial<Parameters<typeof buildExport>[2]> = {},
): string {
  const exporter = new HtmlExporter();
  buildExport(
    exporter,
    { projectTitle: "p", chapters: [{ title: "c", content }] },
    opts({ scope: "chapter", ...overrides }),
  );
  return exporter.toString();
}

describe("HtmlExporter", () => {
  it("renders headings and paragraphs", () => {
    expect(renderChapter("## Heading\n\nParagraph text")).toBe(
      "<h2>Heading</h2>\n<p>Paragraph text</p>",
    );
  });

  it("renders bold, italic, code, and strikethrough marks", () => {
    expect(renderChapter("**bold** *italic* `code` ~~strike~~")).toBe(
      "<p><strong>bold</strong> <em>italic</em> <code>code</code> <s>strike</s></p>",
    );
  });

  it("renders a Writr scene-break marker as <hr>", () => {
    expect(
      renderChapter(
        'Before.\n\n<hr data-type="sceneBreak" data-scene-id="abc">\n\nAfter.',
      ),
    ).toBe("<p>Before.</p>\n<hr>\n<p>After.</p>");
  });

  it("renders a hard line break as <br/>", () => {
    expect(renderChapter("line one  \nline two")).toBe(
      "<p>line one<br/>line two</p>",
    );
  });

  it("includes a title page when includeTitlePage is set and scope is book", () => {
    const exporter = new HtmlExporter();
    buildExport(
      exporter,
      {
        projectTitle: "My Book",
        chapters: [{ title: "Chapter 1", content: "First" }],
      },
      opts({ includeTitlePage: true, includeChapterHeadings: true }),
    );
    const html = exporter.toString();
    expect(html).toContain("<h1>My Book</h1>");
    expect(html).toContain("<h2>Chapter 1</h2>");
  });

  it("escapes special characters in text", () => {
    expect(renderChapter('a < b, c > d, and "quoted"')).toBe(
      "<p>a &lt; b, c &gt; d, and &quot;quoted&quot;</p>",
    );
  });

  it("escapes ampersands", () => {
    expect(renderChapter("Tom & Jerry")).toBe("<p>Tom &amp; Jerry</p>");
  });

  it("escapes title page content", () => {
    const exporter = new HtmlExporter();
    buildExport(
      exporter,
      {
        projectTitle: "Tom & Jerry's <Adventure>",
        chapters: [{ title: "Chapter 1", content: "Test" }],
      },
      opts({ includeTitlePage: true }),
    );
    expect(exporter.toString()).toContain(
      "<h1>Tom &amp; Jerry's &lt;Adventure&gt;</h1>",
    );
  });
});
