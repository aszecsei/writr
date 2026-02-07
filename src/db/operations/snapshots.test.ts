import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../database";
import {
  createSnapshot,
  deleteSnapshot,
  getSnapshot,
  getSnapshotsByChapter,
} from "./snapshots";

const projectId = "a1111111-1111-4111-a111-111111111111";
const chapterId1 = "b1111111-1111-4111-a111-111111111111";
const chapterId2 = "c1111111-1111-4111-a111-111111111111";

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

  it("should get a snapshot by id", async () => {
    const snap = await createSnapshot({
      chapterId: chapterId1,
      projectId,
      name: "Snap A",
      content: "Content A",
      wordCount: 2,
    });

    const fetched = await getSnapshot(snap.id);
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe("Snap A");
  });

  it("should return undefined for non-existent snapshot", async () => {
    const fetched = await getSnapshot("d1111111-1111-4111-a111-111111111111");
    expect(fetched).toBeUndefined();
  });

  it("should list snapshots by chapter in reverse-chronological order", async () => {
    await createSnapshot({
      chapterId: chapterId1,
      projectId,
      name: "First",
      content: "A",
      wordCount: 1,
    });
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    await createSnapshot({
      chapterId: chapterId1,
      projectId,
      name: "Second",
      content: "A B",
      wordCount: 2,
    });
    await new Promise((r) => setTimeout(r, 10));
    await createSnapshot({
      chapterId: chapterId1,
      projectId,
      name: "Third",
      content: "A B C",
      wordCount: 3,
    });

    const snaps = await getSnapshotsByChapter(chapterId1);
    expect(snaps).toHaveLength(3);
    expect(snaps[0].name).toBe("Third");
    expect(snaps[1].name).toBe("Second");
    expect(snaps[2].name).toBe("First");
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
    const fetched = await getSnapshot(snap.id);
    expect(fetched).toBeUndefined();
  });

  it("should isolate snapshots between chapters", async () => {
    await createSnapshot({
      chapterId: chapterId1,
      projectId,
      name: "Ch1 Snap",
      content: "chapter 1",
      wordCount: 2,
    });
    await createSnapshot({
      chapterId: chapterId2,
      projectId,
      name: "Ch2 Snap",
      content: "chapter 2",
      wordCount: 2,
    });

    const snaps1 = await getSnapshotsByChapter(chapterId1);
    const snaps2 = await getSnapshotsByChapter(chapterId2);

    expect(snaps1).toHaveLength(1);
    expect(snaps1[0].name).toBe("Ch1 Snap");
    expect(snaps2).toHaveLength(1);
    expect(snaps2[0].name).toBe("Ch2 Snap");
  });

});
