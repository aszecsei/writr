import { getChapter, getChaptersByProject, getProject } from "@/db/operations";
import type { ExportContent, ExportOptions } from "./types";

export async function gatherContent(
  options: ExportOptions,
): Promise<ExportContent> {
  const project = await getProject(options.projectId);
  if (!project) throw new Error("Project not found");

  if (options.scope === "chapter" && options.chapterId) {
    const chapter = await getChapter(options.chapterId);
    if (!chapter) throw new Error("Chapter not found");
    return {
      projectTitle: project.title,
      chapters: [{ title: chapter.title, content: chapter.content }],
    };
  }

  const chapters = await getChaptersByProject(options.projectId);
  return {
    projectTitle: project.title,
    chapters: chapters.map((ch) => ({ title: ch.title, content: ch.content })),
  };
}
