// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExtensions } from "@/components/editor/extensions";
import { db } from "@/db/database";
import type { ChapterId, Comment, ProjectId } from "@/db/schemas";
import { replaceEditorContent } from "@/lib/editor/replace-content";
import { makeComment, resetIdCounter } from "@/test/helpers";
import { useEditorCommentSync } from "./useEditorCommentSync";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const chapterId = "b2222222-2222-4222-a222-222222222222" as ChapterId;

let editor: Editor;

/** PM range of the first occurrence of `text` in the live editor doc. */
function locate(text: string): { from: number; to: number } {
  let found: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found || !node.isText || !node.text) return;
    const idx = node.text.indexOf(text);
    if (idx >= 0) found = { from: pos + idx, to: pos + idx + text.length };
  });
  if (!found) throw new Error(`text not found: ${text}`);
  return found;
}

beforeEach(async () => {
  resetIdCounter();
  await db.comments.clear();
  editor = new Editor({ extensions: createExtensions(), content: "" });
  replaceEditorContent(editor, "The quick brown fox.", {
    isScreenplay: false,
  });
});

afterEach(() => {
  editor.destroy();
});

describe("useEditorCommentSync", () => {
  it("re-anchors comments against the current document after a reset", async () => {
    const original = locate("brown");
    const comment = makeComment({
      projectId,
      chapterId,
      anchorText: "brown",
      fromOffset: original.from,
      toOffset: original.to,
    });
    await db.comments.add(comment);
    const commentsRef = { current: [] as Comment[] };
    const initializedRef = { current: true };

    const { result, rerender } = renderHook(
      (props: { comments: Comment[] }) =>
        useEditorCommentSync(
          editor,
          props.comments,
          commentsRef,
          initializedRef,
        ),
      { initialProps: { comments: [comment] } },
    );
    // First-seen reconcile: positions already match, so nothing moves.
    await vi.waitFor(async () => {
      const row = await db.comments.get(comment.id);
      expect(row?.fromOffset).toBe(original.from);
    });

    // The anchored text moves (a whole-document replacement, as after a
    // staged edit); the stored offsets are now stale.
    replaceEditorContent(editor, "Now the very quick brown fox.", {
      isScreenplay: false,
    });
    const moved = locate("brown");
    expect(moved.from).not.toBe(original.from);
    // Without a reset the comment is skipped as already reconciled.
    rerender({ comments: [comment] });

    act(() => {
      result.current.resetReconcile();
    });

    await vi.waitFor(async () => {
      const row = await db.comments.get(comment.id);
      expect(row?.fromOffset).toBe(moved.from);
      expect(row?.toOffset).toBe(moved.to);
    });
  });
});
