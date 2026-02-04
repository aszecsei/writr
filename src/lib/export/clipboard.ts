import { getChapter, getProject } from "@/db/operations";
import { exportHtml } from "./exportHtml";

export interface ClipboardChapterOptions {
  projectId: string;
  chapterId: string;
  includeChapterHeading: boolean;
}

export async function copyChapterMarkdownToClipboard(
  options: ClipboardChapterOptions,
): Promise<void> {
  const chapter = await getChapter(options.chapterId);
  if (!chapter) throw new Error("Chapter not found");

  const parts: string[] = [];

  if (options.includeChapterHeading) {
    parts.push(`## ${chapter.title}\n`);
  }

  parts.push(chapter.content);

  await navigator.clipboard.writeText(parts.join("\n"));
}

export async function copyChapterAo3HtmlToClipboard(
  options: ClipboardChapterOptions,
): Promise<void> {
  const [chapter, project] = await Promise.all([
    getChapter(options.chapterId),
    getProject(options.projectId),
  ]);

  if (!chapter) throw new Error("Chapter not found");
  if (!project) throw new Error("Project not found");

  const html = exportHtml(
    {
      projectTitle: project.title,
      chapters: [{ title: chapter.title, content: chapter.content }],
    },
    {
      format: "markdown",
      scope: "chapter",
      projectId: options.projectId,
      chapterId: options.chapterId,
      includeTitlePage: false,
      includeChapterHeadings: options.includeChapterHeading,
      pageBreaksBetweenChapters: false,
    },
  );

  await navigator.clipboard.writeText(html);
}
