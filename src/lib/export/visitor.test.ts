import { describe, expect, it, vi } from "vitest";
import type { DocNode } from "./markdown-to-nodes";
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
    ...createMockVisitor(),
    addTitlePage: vi.fn(),
    addChapterHeading: vi.fn(),
    addPageBreak: vi.fn(),
    toBlob: vi.fn().mockResolvedValue(new Blob()),
  };
}

describe("visitNode", () => {
  it("dispatches heading to visitHeading", () => {
    const visitor = createMockVisitor();
    const node: DocNode = {
      type: "heading",
      level: 1,
      spans: [{ text: "Title", styles: [] }],
    };
    visitNode(node, visitor);
    expect(visitor.visitHeading).toHaveBeenCalledWith(node);
  });

  it("dispatches paragraph to visitParagraph", () => {
    const visitor = createMockVisitor();
    const node: DocNode = {
      type: "paragraph",
      spans: [{ text: "Text", styles: [] }],
    };
    visitNode(node, visitor);
    expect(visitor.visitParagraph).toHaveBeenCalledWith(node);
  });

  it("dispatches blockquote to visitBlockquote", () => {
    const visitor = createMockVisitor();
    const node: DocNode = { type: "blockquote", children: [] };
    visitNode(node, visitor);
    expect(visitor.visitBlockquote).toHaveBeenCalledWith(node);
  });

  it("dispatches list to visitList", () => {
    const visitor = createMockVisitor();
    const node: DocNode = { type: "list", ordered: false, items: [] };
    visitNode(node, visitor);
    expect(visitor.visitList).toHaveBeenCalledWith(node);
  });

  it("dispatches code to visitCode", () => {
    const visitor = createMockVisitor();
    const node: DocNode = { type: "code", text: "x = 1" };
    visitNode(node, visitor);
    expect(visitor.visitCode).toHaveBeenCalledWith(node);
  });

  it("dispatches hr to visitHr", () => {
    const visitor = createMockVisitor();
    const node: DocNode = { type: "hr" };
    visitNode(node, visitor);
    expect(visitor.visitHr).toHaveBeenCalledWith(node);
  });

  it("dispatches image to visitImage", () => {
    const visitor = createMockVisitor();
    const node: DocNode = { type: "image", src: "test.png" };
    visitNode(node, visitor);
    expect(visitor.visitImage).toHaveBeenCalledWith(node);
  });

  it("dispatches pageBreak to visitPageBreak", () => {
    const visitor = createMockVisitor();
    const node: DocNode = { type: "pageBreak" };
    visitNode(node, visitor);
    expect(visitor.visitPageBreak).toHaveBeenCalledWith(node);
  });
});

describe("visitNodes", () => {
  it("visits all nodes in order", () => {
    const visitor = createMockVisitor();
    const nodes: DocNode[] = [
      { type: "heading", level: 1, spans: [{ text: "H", styles: [] }] },
      { type: "paragraph", spans: [{ text: "P", styles: [] }] },
      { type: "hr" },
    ];
    visitNodes(nodes, visitor);
    expect(visitor.visitHeading).toHaveBeenCalledTimes(1);
    expect(visitor.visitParagraph).toHaveBeenCalledTimes(1);
    expect(visitor.visitHr).toHaveBeenCalledTimes(1);
  });

  it("handles empty array", () => {
    const visitor = createMockVisitor();
    visitNodes([], visitor);
    for (const fn of Object.values(visitor)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});

describe("buildExport", () => {
  it("adds title page when includeTitlePage is true and scope is book", () => {
    const exporter = createMockExporter();
    buildExport(
      exporter,
      { projectTitle: "My Book", chapters: [{ title: "Ch1", content: "" }] },
      {
        format: "docx",
        scope: "book",
        projectId: "p1",
        includeTitlePage: true,
        includeChapterHeadings: false,
        pageBreaksBetweenChapters: false,
      },
    );
    expect(exporter.addTitlePage).toHaveBeenCalledWith("My Book");
  });

  it("skips title page when scope is chapter", () => {
    const exporter = createMockExporter();
    buildExport(
      exporter,
      { projectTitle: "My Book", chapters: [{ title: "Ch1", content: "" }] },
      {
        format: "docx",
        scope: "chapter",
        projectId: "p1",
        includeTitlePage: true,
        includeChapterHeadings: false,
        pageBreaksBetweenChapters: false,
      },
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
      {
        format: "docx",
        scope: "book",
        projectId: "p1",
        includeTitlePage: false,
        includeChapterHeadings: true,
        pageBreaksBetweenChapters: false,
      },
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
      {
        format: "docx",
        scope: "book",
        projectId: "p1",
        includeTitlePage: false,
        includeChapterHeadings: false,
        pageBreaksBetweenChapters: true,
      },
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
      {
        format: "docx",
        scope: "chapter",
        projectId: "p1",
        includeTitlePage: false,
        includeChapterHeadings: false,
        pageBreaksBetweenChapters: true,
      },
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
      {
        format: "docx",
        scope: "chapter",
        projectId: "p1",
        includeTitlePage: false,
        includeChapterHeadings: false,
        pageBreaksBetweenChapters: false,
      },
    );
    // "Hello **world**" parses to a single paragraph node
    expect(exporter.visitParagraph).toHaveBeenCalledTimes(1);
  });
});
