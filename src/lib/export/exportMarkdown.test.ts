import { describe, expect, it } from "vitest";
import { exportMarkdown } from "./exportMarkdown";
import type { ExportContent, ExportOptions } from "./types";

function makeContent(overrides?: Partial<ExportContent>): ExportContent {
  return {
    projectTitle: "My Novel",
    chapters: [
      { title: "Chapter 1", content: "First chapter text." },
      { title: "Chapter 2", content: "Second chapter text." },
    ],
    ...overrides,
  };
}

function makeOptions(overrides?: Partial<ExportOptions>): ExportOptions {
  return {
    format: "markdown",
    scope: "book",
    projectId: "00000000-0000-4000-8000-000000000001",
    includeTitlePage: true,
    includeChapterHeadings: true,
    pageBreaksBetweenChapters: false,
    ...overrides,
  };
}

async function blobText(blob: Blob): Promise<string> {
  return blob.text();
}

describe("exportMarkdown", () => {
  it("includes title page when scope=book and includeTitlePage=true", async () => {
    const blob = exportMarkdown(makeContent(), makeOptions());
    const text = await blobText(blob);
    expect(text).toContain("# My Novel");
    expect(text).toContain("---");
  });

  it("excludes title page when scope=chapter", async () => {
    const blob = exportMarkdown(
      makeContent(),
      makeOptions({ scope: "chapter" }),
    );
    const text = await blobText(blob);
    expect(text).not.toContain("# My Novel");
  });

  it("excludes title page when includeTitlePage=false", async () => {
    const blob = exportMarkdown(
      makeContent(),
      makeOptions({ includeTitlePage: false }),
    );
    const text = await blobText(blob);
    expect(text).not.toContain("# My Novel");
  });

  it("includes chapter headings when flag is true", async () => {
    const blob = exportMarkdown(
      makeContent(),
      makeOptions({ includeChapterHeadings: true }),
    );
    const text = await blobText(blob);
    expect(text).toContain("## Chapter 1");
    expect(text).toContain("## Chapter 2");
  });

  it("excludes chapter headings when flag is false", async () => {
    const blob = exportMarkdown(
      makeContent(),
      makeOptions({ includeChapterHeadings: false }),
    );
    const text = await blobText(blob);
    expect(text).not.toContain("## Chapter 1");
    expect(text).not.toContain("## Chapter 2");
    expect(text).toContain("First chapter text.");
  });

  it("separates multiple chapters with blank lines", async () => {
    const blob = exportMarkdown(makeContent(), makeOptions());
    const text = await blobText(blob);
    // Between the end of chapter 1 content and start of chapter 2 heading
    expect(text).toContain("First chapter text.\n\n");
  });

  it("returns blob with correct MIME type", () => {
    const blob = exportMarkdown(makeContent(), makeOptions());
    expect(blob.type).toBe("text/markdown;charset=utf-8");
  });
});
