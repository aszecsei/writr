import { db } from "../database";
import { type ChapterSnapshot, ChapterSnapshotSchema } from "../schemas";
import { generateId, now } from "./helpers";

// ─── Chapter Snapshots ──────────────────────────────────────────────

export async function getSnapshotsByChapter(
  chapterId: string,
): Promise<ChapterSnapshot[]> {
  return db.chapterSnapshots.where({ chapterId }).reverse().sortBy("createdAt");
}

export async function getSnapshot(
  id: string,
): Promise<ChapterSnapshot | undefined> {
  return db.chapterSnapshots.get(id);
}

export async function createSnapshot(
  data: Pick<
    ChapterSnapshot,
    "chapterId" | "projectId" | "name" | "content" | "wordCount"
  >,
): Promise<ChapterSnapshot> {
  const snapshot = ChapterSnapshotSchema.parse({
    id: generateId(),
    chapterId: data.chapterId,
    projectId: data.projectId,
    name: data.name,
    content: data.content,
    wordCount: data.wordCount,
    createdAt: now(),
  });
  await db.chapterSnapshots.add(snapshot);
  return snapshot;
}

export async function deleteSnapshot(id: string): Promise<void> {
  await db.chapterSnapshots.delete(id);
}
