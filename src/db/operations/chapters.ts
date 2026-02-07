import { db } from "../database";
import { type Chapter, ChapterSchema } from "../schemas";
import { generateId, now, reorderEntities } from "./helpers";
import { recordWritingSession } from "./sprints";

// ─── Chapters ────────────────────────────────────────────────────────

export async function getChaptersByProject(
  projectId: string,
): Promise<Chapter[]> {
  return db.chapters.where({ projectId }).sortBy("order");
}

export async function getChapter(id: string): Promise<Chapter | undefined> {
  return db.chapters.get(id);
}

export async function createChapter(
  data: Pick<Chapter, "projectId" | "title"> &
    Partial<Pick<Chapter, "order" | "content" | "synopsis">>,
): Promise<Chapter> {
  const order =
    data.order ??
    (await db.chapters.where({ projectId: data.projectId }).count());
  const chapter = ChapterSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    title: data.title,
    order,
    content: data.content ?? "",
    synopsis: data.synopsis ?? "",
    status: "draft",
    wordCount: 0,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.chapters.add(chapter);
  return chapter;
}

export async function updateChapter(
  id: string,
  data: Partial<Pick<Chapter, "title" | "synopsis" | "status">>,
): Promise<void> {
  await db.chapters.update(id, { ...data, updatedAt: now() });
}

export async function updateChapterContent(
  id: string,
  content: string,
  wordCount: number,
): Promise<void> {
  const chapter = await db.chapters.get(id);
  const previousWordCount = chapter?.wordCount ?? 0;

  await db.chapters.update(id, { content, wordCount, updatedAt: now() });

  // Record writing session if word count changed
  if (chapter && wordCount !== previousWordCount) {
    recordWritingSession(chapter.projectId, id, previousWordCount, wordCount);
  }
}

export async function reorderChapters(orderedIds: string[]): Promise<void> {
  return reorderEntities(db.chapters, orderedIds);
}
