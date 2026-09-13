// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChapterId, Comment, ProjectId } from "@/db/schemas";
import { makeComment, resetIdCounter } from "@/test/helpers";
import {
  COMMENTS_RESET_META,
  COMMENTS_UPDATED_META,
  getCommentPositions,
} from "./Comments";
import { createExtensions } from "./index";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const chapterId = "b2222222-2222-4222-a222-222222222222" as ChapterId;

let editor: Editor;
let commentsRef: { current: Comment[] };
let comment: Comment;

function dispatchMeta(meta: string) {
  editor.view.dispatch(editor.state.tr.setMeta(meta, true));
}

beforeEach(() => {
  resetIdCounter();
  commentsRef = { current: [] };
  editor = new Editor({
    extensions: createExtensions({ commentsRef }),
    content: "<p>The quick brown fox.</p>",
  });
  // "brown" sits at PM positions 11..16 inside the single paragraph.
  comment = makeComment({
    projectId,
    chapterId,
    anchorText: "brown",
    fromOffset: 11,
    toOffset: 16,
  });
  commentsRef.current = [comment];
  dispatchMeta(COMMENTS_UPDATED_META);
});

afterEach(() => {
  editor.destroy();
});

describe("Comments extension position tracking", () => {
  it("tracks positions through an ordinary edit", () => {
    editor.commands.insertContentAt(1, "Very ");

    const pos = getCommentPositions(editor.state).get(comment.id);
    expect(pos).toEqual({ from: 16, to: 21 });
    expect(editor.state.doc.textBetween(16, 21)).toBe("brown");
  });

  it("rebuilds positions from stored offsets after a reset", () => {
    editor
      .chain()
      .setContent("<p>A brown fox.</p>", { emitUpdate: false })
      .setMeta(COMMENTS_RESET_META, true)
      .run();
    expect(getCommentPositions(editor.state).size).toBe(0);

    // The next comments emission (after reconcile wrote fresh offsets)
    // adopts the stored positions rather than any tracked ones.
    commentsRef.current = [{ ...comment, fromOffset: 3, toOffset: 8 }];
    dispatchMeta(COMMENTS_UPDATED_META);

    const pos = getCommentPositions(editor.state).get(comment.id);
    expect(pos).toEqual({ from: 3, to: 8 });
    expect(editor.state.doc.textBetween(3, 8)).toBe("brown");
  });
});
