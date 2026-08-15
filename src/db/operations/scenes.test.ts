import { beforeEach, describe, expect, it } from "vitest";
import { makeChapter, makeScene, resetIdCounter } from "@/test/helpers";
import { db } from "../database";
import type {
  ChapterId,
  CharacterId,
  CommentId,
  ProjectId,
  SceneId,
} from "../schemas";
import { deleteChapter } from "./chapters";
import { deleteProject } from "./projects";
import {
  createScene,
  deleteScene,
  getScene,
  getScenesByChapter,
  moveScene,
  nextSceneOrder,
  reorderScenes,
  updateScene,
  updateSceneWordCounts,
} from "./scenes";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const chapterA = "b1111111-1111-4111-a111-111111111111" as ChapterId;
const chapterB = "b2222222-2222-4222-a222-222222222222" as ChapterId;

async function seedChapters() {
  await db.chapters.add(makeChapter({ id: chapterA, projectId, title: "A" }));
  await db.chapters.add(makeChapter({ id: chapterB, projectId, title: "B" }));
}

describe("createScene / nextSceneOrder", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.scenes.clear();
    await db.chapters.clear();
  });

  it("assigns order 0 to the first scene and appends afterward", async () => {
    await seedChapters();
    expect(await nextSceneOrder(chapterA)).toBe(0);

    const first = await createScene({ projectId, chapterId: chapterA });
    expect(first.order).toBe(0);

    const second = await createScene({ projectId, chapterId: chapterA });
    expect(second.order).toBe(1);
  });

  it("honors a caller-supplied id so the marker attr and row agree", async () => {
    await seedChapters();
    const id = "c1111111-1111-4111-a111-111111111111" as SceneId;
    const scene = await createScene({ id, projectId, chapterId: chapterA });
    expect(scene.id).toBe(id);
  });
});

describe("updateScene", () => {
  const povId = "d1111111-1111-4111-a111-111111111111" as CharacterId;

  beforeEach(async () => {
    resetIdCounter();
    await db.scenes.clear();
    await db.chapters.clear();
  });

  it("leaves omitted fields untouched (a partial update is a no-op for them)", async () => {
    await seedChapters();
    const scene = await createScene({
      projectId,
      chapterId: chapterA,
      title: "Original",
      povCharacterId: povId,
    });

    // Update only the title; povCharacterId is not in the payload.
    await updateScene(scene.id, { title: "Renamed" });

    const updated = await getScene(scene.id);
    expect(updated?.title).toBe("Renamed");
    // Regression: omitting povCharacterId must NOT clear it.
    expect(updated?.povCharacterId).toBe(povId);
  });

  it("clears a field when an explicit null is passed", async () => {
    await seedChapters();
    const scene = await createScene({
      projectId,
      chapterId: chapterA,
      povCharacterId: povId,
    });

    await updateScene(scene.id, { povCharacterId: null });

    const updated = await getScene(scene.id);
    expect(updated?.povCharacterId).toBeNull();
  });
});

describe("updateSceneWordCounts", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.scenes.clear();
  });

  it("writes changed counts and skips unchanged rows", async () => {
    const s1 = makeScene({ projectId, chapterId: chapterA, wordCount: 10 });
    const s2 = makeScene({ projectId, chapterId: chapterA, wordCount: 20 });
    await db.scenes.bulkAdd([s1, s2]);

    await updateSceneWordCounts(
      new Map([
        [s1.id, 15],
        [s2.id, 20],
      ]),
    );

    const after1 = await db.scenes.get(s1.id);
    const after2 = await db.scenes.get(s2.id);
    expect(after1?.wordCount).toBe(15);
    expect(after1?.updatedAt).not.toBe(s1.updatedAt); // changed → timestamp bump
    expect(after2?.wordCount).toBe(20);
    expect(after2?.updatedAt).toBe(s2.updatedAt); // unchanged → no write
  });
});

describe("deleteScene / reorderScenes", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.scenes.clear();
  });

  it("renumbers remaining scenes contiguously after a delete", async () => {
    const s0 = makeScene({ projectId, chapterId: chapterA, order: 0 });
    const s1 = makeScene({ projectId, chapterId: chapterA, order: 1 });
    const s2 = makeScene({ projectId, chapterId: chapterA, order: 2 });
    await db.scenes.bulkAdd([s0, s1, s2]);

    await deleteScene(s1.id);

    const remaining = await getScenesByChapter(chapterA);
    expect(remaining.map((s) => s.id)).toEqual([s0.id, s2.id]);
    expect(remaining.map((s) => s.order)).toEqual([0, 1]);
  });

  it("reorders scenes to match the given id order", async () => {
    const s0 = makeScene({ projectId, chapterId: chapterA, order: 0 });
    const s1 = makeScene({ projectId, chapterId: chapterA, order: 1 });
    const s2 = makeScene({ projectId, chapterId: chapterA, order: 2 });
    await db.scenes.bulkAdd([s0, s1, s2]);

    await reorderScenes(chapterA, [s2.id, s0.id, s1.id]);

    const ordered = await getScenesByChapter(chapterA);
    expect(ordered.map((s) => s.id)).toEqual([s2.id, s0.id, s1.id]);
    expect(ordered.map((s) => s.order)).toEqual([0, 1, 2]);
  });
});

describe("moveScene", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.scenes.clear();
    await db.chapters.clear();
    await db.comments.clear();
  });

  it("moves a scene to another chapter and renumbers both groups", async () => {
    await seedChapters();
    const a0 = makeScene({ projectId, chapterId: chapterA, order: 0 });
    const a1 = makeScene({ projectId, chapterId: chapterA, order: 1 });
    const b0 = makeScene({ projectId, chapterId: chapterB, order: 0 });
    await db.scenes.bulkAdd([a0, a1, b0]);

    await moveScene(a1.id, { chapterId: chapterB });

    const inA = await getScenesByChapter(chapterA);
    const inB = await getScenesByChapter(chapterB);
    expect(inA.map((s) => s.id)).toEqual([a0.id]);
    expect(inA[0].order).toBe(0);
    expect(inB.map((s) => s.id)).toEqual([b0.id, a1.id]);
    expect(inB.map((s) => s.order)).toEqual([0, 1]);
  });

  it("applies the comment rebase in the same transaction", async () => {
    await seedChapters();
    const a1 = makeScene({ projectId, chapterId: chapterA, order: 1 });
    await db.scenes.add(a1);
    const commentId = "d1111111-1111-4111-a111-111111111111" as CommentId;
    await db.comments.add({
      id: commentId,
      projectId,
      chapterId: chapterA,
      content: "note",
      color: "yellow",
      fromOffset: 100,
      toOffset: 110,
      anchorText: "",
      status: "active",
      resolvedAt: null,
      author: "",
      authorColor: "",
      parentCommentId: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    await moveScene(a1.id, { chapterId: chapterB }, [
      { commentId, chapterId: chapterB, fromOffset: 5, toOffset: 15 },
    ]);

    const moved = await db.comments.get(commentId);
    expect(moved?.chapterId).toBe(chapterB);
    expect(moved?.fromOffset).toBe(5);
    expect(moved?.toOffset).toBe(15);
  });
});

describe("cascade deletes", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.scenes.clear();
    await db.chapters.clear();
  });

  it("deletes a chapter's scenes when the chapter is deleted", async () => {
    await seedChapters();
    await db.scenes.add(makeScene({ projectId, chapterId: chapterA }));
    await db.scenes.add(makeScene({ projectId, chapterId: chapterB }));

    await deleteChapter(chapterA, "cascade");

    expect(await getScenesByChapter(chapterA)).toHaveLength(0);
    expect(await getScenesByChapter(chapterB)).toHaveLength(1);
  });

  it("deletes all project scenes when the project is deleted", async () => {
    await db.projects.add({
      id: projectId,
      title: "P",
      description: "",
      genre: "",
      targetWordCount: 0,
      mode: "prose",
      coverImageUrl: "",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    await seedChapters();
    await db.scenes.add(makeScene({ projectId, chapterId: chapterA }));

    await deleteProject(projectId);

    expect(await db.scenes.where({ projectId }).count()).toBe(0);
  });
});
