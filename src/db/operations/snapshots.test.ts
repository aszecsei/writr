import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../database";
import type { ChapterId, ProjectId } from "../schemas";
import { createSnapshot, deleteSnapshot } from "./snapshots";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const chapterId1 = "b1111111-1111-4111-a111-111111111111" as ChapterId;

describe("snapshot operations", () => {
  beforeEach(async () => {
    await db.chapterSnapshots.clear();
  });

  it("should create a snapshot and return it", async () => {
    const snap = await createSnapshot({
      chapterId: chapterId1,
      projectId,
      name: "Draft 1",
      content: "Hello world",
      wordCount: 2,
    });

    expect(snap.id).toBeDefined();
    expect(snap.chapterId).toBe(chapterId1);
    expect(snap.projectId).toBe(projectId);
    expect(snap.name).toBe("Draft 1");
    expect(snap.content).toBe("Hello world");
    expect(snap.wordCount).toBe(2);
    expect(snap.createdAt).toBeDefined();
  });

  it("should delete a single snapshot", async () => {
    const snap = await createSnapshot({
      chapterId: chapterId1,
      projectId,
      name: "To Delete",
      content: "bye",
      wordCount: 1,
    });

    await deleteSnapshot(snap.id);
    const fetched = await db.chapterSnapshots.get(snap.id);
    expect(fetched).toBeUndefined();
  });
});
