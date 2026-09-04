import { describe, expect, it, vi } from "vitest";
import type { DocNode } from "./markdown-to-nodes";
import { opts } from "./test-helpers";
import type { DocNodeVisitor, Exporter } from "./visitor";
import { buildExport, visitNode, visitNodes } from "./visitor";

function createMockVisitor(): DocNodeVisitor &
  Record<string, ReturnType<typeof vi.fn>> {
  return {
    visitHeading: vi.fn(),
    visitParagraph: vi.fn(),
    visitBlockquote: vi.fn(),
    visitList: vi.fn(),
    visitCode: vi.fn(),
    visitHr: vi.fn(),
    visitImage: vi.fn(),
    visitPageBreak: vi.fn(),
  };
}

function createMockExporter(): Exporter &
  Record<string, ReturnType<typeof vi.fn>> {
  return {
    visitHeading: vi.fn(),
    visitParagraph: vi.fn(),
    visitBlockquote: vi.fn(),
    visitList: vi.fn(),
    visitCode: vi.fn(),
    visitHr: vi.fn(),
    visitImage: vi.fn(),
    visitPageBreak: vi.fn(),
    addTitlePage: vi.fn(),
    addChapterHeading: vi.fn(),
    addPageBreak: vi.fn(),
    toBlob: vi.fn().mockResolvedValue(new Blob()),
  };
}

describe("visitNode", () => {
  it.each<[keyof DocNodeVisitor, DocNode]>([
    [
      "visitHeading",
      {
        type: "heading",
        level: 1,
        spans: [{ type: "text", text: "Title", styles: [] }],
      },
    ],
    [
      "visitParagraph",
      {
        type: "paragraph",
        spans: [{ type: "text", text: "Text", styles: [] }],
      },
    ],
    ["visitBlockquote", { type: "blockquote", children: [] }],
    ["visitList", { type: "list", ordered: false, items: [] }],
    ["visitCode", { type: "code", text: "x = 1" }],
    ["visitHr", { type: "hr" }],
    ["visitImage", { type: "image", src: "test.png" }],
    ["visitPageBreak", { type: "pageBreak" }],
  ])("dispatches to %s", (method, node) => {
    const visitor = createMockVisitor();
    visitNode(node, visitor);
    expect(visitor[method]).toHaveBeenCalledWith(node);
  });
});

describe("visitNodes", () => {
  it("visits all nodes in order", () => {
    const visitor = createMockVisitor();
    const nodes: DocNode[] = [
      {
        type: "heading",
        level: 1,
        spans: [{ type: "text", text: "H", styles: [] }],
      },
      {
        type: "paragraph",
        spans: [{ type: "text", text: "P", styles: [] }],
      },
      { type: "hr" },
    ];
    visitNodes(nodes, visitor);
    expect(visitor.visitHeading).toHaveBeenCalledTimes(1);
    expect(visitor.visitParagraph).toHaveBeenCalledTimes(1);
    expect(visitor.visitHr).toHaveBeenCalledTimes(1);
  });
});

describe("buildExport", () => {
  it("adds title page when includeTitlePage is true and scope is book", () => {
    const exporter = createMockExporter();
    buildExport(
      exporter,
      { projectTitle: "My Book", chapters: [{ title: "Ch1", content: "" }] },
      opts({ includeTitlePage: true }),
    );
    expect(exporter.addTitlePage).toHaveBeenCalledWith("My Book");
  });

  it("skips title page when scope is chapter", () => {
    const exporter = createMockExporter();
    buildExport(
      exporter,
      { projectTitle: "My Book", chapters: [{ title: "Ch1", content: "" }] },
      opts({ scope: "chapter", includeTitlePage: true }),
    );
    expect(exporter.addTitlePage).not.toHaveBeenCalled();
  });

  it("adds chapter headings when includeChapterHeadings is true", () => {
    const exporter = createMockExporter();
    buildExport(
      exporter,
      {
        projectTitle: "Book",
        chapters: [
          { title: "Chapter 1", content: "" },
          { title: "Chapter 2", content: "" },
        ],
      },
      opts({ includeChapterHeadings: true }),
    );
    expect(exporter.addChapterHeading).toHaveBeenCalledTimes(2);
    expect(exporter.addChapterHeading).toHaveBeenCalledWith("Chapter 1");
    expect(exporter.addChapterHeading).toHaveBeenCalledWith("Chapter 2");
  });

  it("adds page breaks between chapters when enabled", () => {
    const exporter = createMockExporter();
    buildExport(
      exporter,
      {
        projectTitle: "Book",
        chapters: [
          { title: "Ch1", content: "" },
          { title: "Ch2", content: "" },
          { title: "Ch3", content: "" },
        ],
      },
      opts({ pageBreaksBetweenChapters: true }),
    );
    // Page breaks between chapters (not before the first)
    expect(exporter.addPageBreak).toHaveBeenCalledTimes(2);
  });

  it("does not add page breaks when scope is chapter", () => {
    const exporter = createMockExporter();
    buildExport(
      exporter,
      {
        projectTitle: "Book",
        chapters: [
          { title: "Ch1", content: "" },
          { title: "Ch2", content: "" },
        ],
      },
      opts({ scope: "chapter", pageBreaksBetweenChapters: true }),
    );
    expect(exporter.addPageBreak).not.toHaveBeenCalled();
  });

  it("visits nodes from parsed markdown content", () => {
    const exporter = createMockExporter();
    buildExport(
      exporter,
      {
        projectTitle: "Book",
        chapters: [{ title: "Ch1", content: "Hello **world**" }],
      },
      opts({ scope: "chapter" }),
    );
    // "Hello **world**" parses to a single paragraph node
    expect(exporter.visitParagraph).toHaveBeenCalledTimes(1);
  });

  it("renders a separator's heading unconditionally and honors its pageBreakBefore in book scope", () => {
    const exporter = createMockExporter();
    buildExport(
      exporter,
      {
        projectTitle: "Book",
        chapters: [
          {
            title: "Part One",
            content: "",
            isSeparator: true,
            pageBreakBefore: true,
          },
          { title: "Ch1", content: "" },
        ],
      },
      opts({ includeChapterHeadings: false }),
    );
    expect(exporter.addPageBreak).toHaveBeenCalledTimes(1);
    expect(exporter.addChapterHeading).toHaveBeenCalledWith("Part One");
    // Separator content is never parsed as manuscript prose.
    expect(exporter.visitParagraph).not.toHaveBeenCalled();
  });

  it("does not page-break before a separator when scope is chapter", () => {
    const exporter = createMockExporter();
    buildExport(
      exporter,
      {
        projectTitle: "Book",
        chapters: [
          {
            title: "Part One",
            content: "",
            isSeparator: true,
            pageBreakBefore: true,
          },
        ],
      },
      opts({ scope: "chapter", includeChapterHeadings: false }),
    );
    expect(exporter.addPageBreak).not.toHaveBeenCalled();
    expect(exporter.addChapterHeading).toHaveBeenCalledWith("Part One");
  });
});
