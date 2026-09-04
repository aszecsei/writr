import { db } from "../database";
import {
  type ChapterSnapshot,
  type ChapterSnapshotId,
  ChapterSnapshotSchema,
} from "../schemas";
import { createCrud, generateId, now } from "./helpers";

// ─── Chapter Snapshots ──────────────────────────────────────────────

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

export const deleteSnapshot = createCrud<ChapterSnapshot, ChapterSnapshotId>(
  db.chapterSnapshots,
).delete;
