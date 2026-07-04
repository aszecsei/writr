// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { beforeEach, describe, expect, it } from "vitest";
import { createExtensions } from "@/components/editor/extensions";
import { db } from "@/db/database";
import type { ChapterId, CommentId, ProjectId, SceneId } from "@/db/schemas";
import { makeChapter, makeScene, resetIdCounter } from "@/test/helpers";
import {
  deleteSceneWithContent,
  moveSceneToChapter,
  reorderScenesInChapter,
} from "./scene-surgery";
import { sceneBreakMarker } from "./segments";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;

/** Find the PM range of `text` within `content` (first occurrence). */
function locate(content: string, text: string): { from: number; to: number } {
  const editor = new Editor({ extensions: createExtensions(), content });
  try {
    let found: { from: number; to: number } | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (found || !node.isText || !node.text) return;
      const idx = node.text.indexOf(text);
      if (idx >= 0) found = { from: pos + idx, to: pos + idx + text.length };
    });
    if (!found) throw new Error(`text not found: ${text}`);
    return found;
  } finally {
    editor.destroy();
  }
}

/** The text a comment currently covers in a chapter's content. */
function anchoredText(content: string, from: number, to: number): string {
  const editor = new Editor({ extensions: createExtensions(), content });
  try {
    return editor.state.doc.textBetween(from, to);
  } finally {
    editor.destroy();
  }
}

async function seedComment(
  chapterId: ChapterId,
  content: string,
  text: string,
): Promise<CommentId> {
  const { from, to } = locate(content, text);
  const id = crypto.randomUUID() as CommentId;
  await db.comments.add({
    id,
    projectId,
    chapterId,
    content: "note",
    color: "yellow",
    fromOffset: from,
    toOffset: to,
    anchorText: text,
    status: "active",
    resolvedAt: null,
    author: "",
    authorColor: "",
    parentCommentId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
  return id;
}

describe("scene surgery", () => {
  const chA = "b1111111-1111-4111-a111-111111111111" as ChapterId;
  const chB = "b2222222-2222-4222-a222-222222222222" as ChapterId;
  const core = "c0000000-0000-4000-8000-000000000000" as SceneId;
  const s2 = "c0000000-0000-4000-8000-000000000002" as SceneId;

  beforeEach(async () => {
    resetIdCounter();
    await db.scenes.clear();
    await db.chapters.clear();
    await db.comments.clear();
  });

  it("reorder keeps comment anchors over their original text", async () => {
    const content = `Alpha scene body.\n\n${sceneBreakMarker(s2)}\n\nBravo scene body.`;
    await db.chapters.add(
      makeChapter({ id: chA, projectId, title: "A", content }),
    );
    await db.scenes.add(
      makeScene({ id: core, projectId, chapterId: chA, order: 0 }),
    );
    await db.scenes.add(
      makeScene({ id: s2, projectId, chapterId: chA, order: 1 }),
    );
    const c1 = await seedComment(chA, content, "Alpha");
    const c2 = await seedComment(chA, content, "Bravo");

    // Put s2 (Bravo) first — it becomes the coreless core; Alpha gains a marker.
    await reorderScenesInChapter(chA, [s2, core]);

    const after = await db.chapters.get(chA);
    expect(after?.content.indexOf("Bravo")).toBeLessThan(
      after?.content.indexOf("Alpha") ?? -1,
    );
    const cm1 = await db.comments.get(c1);
    const cm2 = await db.comments.get(c2);
    expect(
      anchoredText(
        after?.content ?? "",
        cm1?.fromOffset ?? 0,
        cm1?.toOffset ?? 0,
      ),
    ).toBe("Alpha");
    expect(
      anchoredText(
        after?.content ?? "",
        cm2?.fromOffset ?? 0,
        cm2?.toOffset ?? 0,
      ),
    ).toBe("Bravo");
  });

  it("move re-homes a scene and its comment to the target chapter", async () => {
    const content = `Alpha scene body.\n\n${sceneBreakMarker(s2)}\n\nBravo scene body.`;
    await db.chapters.add(
      makeChapter({ id: chA, projectId, title: "A", content }),
    );
    await db.chapters.add(
      makeChapter({ id: chB, projectId, title: "B", content: "Bee core." }),
    );
    await db.scenes.add(
      makeScene({ id: core, projectId, chapterId: chA, order: 0 }),
    );
    await db.scenes.add(
      makeScene({ id: s2, projectId, chapterId: chA, order: 1 }),
    );
    const bCore = "c0000000-0000-4000-8000-0000000000bb" as SceneId;
    await db.scenes.add(
      makeScene({ id: bCore, projectId, chapterId: chB, order: 0 }),
    );
    const c2 = await seedComment(chA, content, "Bravo");

    await moveSceneToChapter(s2, chB);

    const sceneRow = await db.scenes.get(s2);
    expect(sceneRow?.chapterId).toBe(chB);
    const chAAfter = await db.chapters.get(chA);
    const chBAfter = await db.chapters.get(chB);
    expect(chAAfter?.content).not.toContain("Bravo");
    expect(chBAfter?.content).toContain("Bravo");
    const cm2 = await db.comments.get(c2);
    expect(cm2?.chapterId).toBe(chB);
    expect(
      anchoredText(
        chBAfter?.content ?? "",
        cm2?.fromOffset ?? 0,
        cm2?.toOffset ?? 0,
      ),
    ).toBe("Bravo");
  });

  it("delete removes a scene's content, row, and its comments", async () => {
    const content = `Alpha scene body.\n\n${sceneBreakMarker(s2)}\n\nBravo scene body.`;
    await db.chapters.add(
      makeChapter({ id: chA, projectId, title: "A", content }),
    );
    await db.scenes.add(
      makeScene({ id: core, projectId, chapterId: chA, order: 0 }),
    );
    await db.scenes.add(
      makeScene({ id: s2, projectId, chapterId: chA, order: 1 }),
    );
    const cAlpha = await seedComment(chA, content, "Alpha");
    const cBravo = await seedComment(chA, content, "Bravo");

    await deleteSceneWithContent(s2);

    expect(await db.scenes.get(s2)).toBeUndefined();
    const after = await db.chapters.get(chA);
    expect(after?.content).not.toContain("Bravo");
    expect(after?.content).toContain("Alpha");
    // Bravo's comment is gone; Alpha's survives and still anchors correctly.
    expect(await db.comments.get(cBravo)).toBeUndefined();
    const cm = await db.comments.get(cAlpha);
    expect(
      anchoredText(
        after?.content ?? "",
        cm?.fromOffset ?? 0,
        cm?.toOffset ?? 0,
      ),
    ).toBe("Alpha");
  });
});
