// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createExtensions,
  createScreenplayExtensions,
} from "@/components/editor/extensions";
import { db } from "@/db/database";
import { updateChapterContent } from "@/db/operations/chapters";
import type { ChapterId, ProjectId } from "@/db/schemas";
import { replaceEditorContent } from "@/lib/editor/replace-content";
import { getMarkdown } from "@/lib/editor/tiptap-storage";
import { serializeFountain } from "@/lib/fountain";
import { useEditorStore } from "@/store/editorStore";
import { makeChapter, resetIdCounter } from "@/test/helpers";
import { type UseStagedEditsOptions, useStagedEdits } from "./useStagedEdits";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const OTHER_CHAPTER = "b2222222-2222-4222-a222-222222222222" as ChapterId;

let editor: Editor;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function seed(content: string, isScreenplay = false) {
  const chapter = makeChapter({ projectId, title: "Ch", content });
  await db.chapters.add(chapter);
  editor = new Editor({
    extensions: isScreenplay
      ? createScreenplayExtensions()
      : createExtensions(),
    content: "",
  });
  replaceEditorContent(editor, content, { isScreenplay });
  return chapter;
}

/** A stand-in for ChapterEditor's `save`: persist what the editor holds. */
function saveFromEditor(
  chapterId: ChapterId,
  isScreenplay: boolean,
  gate?: Promise<void>,
) {
  return vi.fn(async () => {
    const content = isScreenplay
      ? serializeFountain(editor.state.doc)
      : getMarkdown(editor.storage);
    await gate;
    await updateChapterContent(chapterId, content, 0);
  });
}

function render(options: UseStagedEditsOptions) {
  return renderHook((props: UseStagedEditsOptions) => useStagedEdits(props), {
    initialProps: options,
  });
}

function requestReplace(
  chapterId: ChapterId,
  anchorText: string,
  newContent: string,
  editId = "e1",
) {
  act(() => {
    useEditorStore.getState().requestStagedEdit({
      editId,
      chapterId,
      kind: "replace",
      anchorText,
      newContent,
    });
  });
}

beforeEach(async () => {
  resetIdCounter();
  await db.chapters.clear();
  useEditorStore.setState({
    isDirty: false,
    saveStatus: "idle",
    wordCount: 0,
    pendingStagedEdit: null,
    stagedEditResults: {},
  });
});

afterEach(() => {
  editor.destroy();
});

describe("useStagedEdits", () => {
  it("applies the edit to the editor at once and persists it before reporting", async () => {
    const chapter = await seed("She walked quickly to the door.");
    const gate = deferred();
    const saveChapter = saveFromEditor(chapter.id, false, gate.promise);
    const resetReconcile = vi.fn();
    render({
      editor,
      chapterId: chapter.id,
      isScreenplay: false,
      saveChapter,
      resetReconcile,
    });

    requestReplace(chapter.id, "walked quickly", "strode");

    expect(editor.getText()).toBe("She strode to the door.");
    expect(useEditorStore.getState().pendingStagedEdit).not.toBeNull();
    expect(useEditorStore.getState().stagedEditResults.e1).toBeUndefined();
    expect(useEditorStore.getState().saveStatus).toBe("saving");
    expect(resetReconcile).toHaveBeenCalledTimes(1);

    gate.resolve();
    await vi.waitFor(() => {
      expect(useEditorStore.getState().stagedEditResults.e1).toBe("applied");
    });
    expect(useEditorStore.getState().pendingStagedEdit).toBeNull();
    expect(useEditorStore.getState().saveStatus).toBe("saved");
    expect(useEditorStore.getState().isDirty).toBe(false);
    const row = await db.chapters.get(chapter.id);
    expect(row?.content).toContain("She strode to the door.");
  });

  it("reports failure and clears the request when it targets another chapter", async () => {
    const chapter = await seed("She walked quickly to the door.");
    const saveChapter = saveFromEditor(chapter.id, false);
    render({
      editor,
      chapterId: chapter.id,
      isScreenplay: false,
      saveChapter,
      resetReconcile: vi.fn(),
    });

    requestReplace(OTHER_CHAPTER, "walked quickly", "strode");

    await vi.waitFor(() => {
      expect(useEditorStore.getState().stagedEditResults.e1).toBe("failed");
    });
    expect(useEditorStore.getState().pendingStagedEdit).toBeNull();
    expect(editor.getText()).toBe("She walked quickly to the door.");
    expect(saveChapter).not.toHaveBeenCalled();
  });

  it("reports failure when the anchor is no longer in the chapter", async () => {
    const chapter = await seed("She walked quickly to the door.");
    const saveChapter = saveFromEditor(chapter.id, false);
    render({
      editor,
      chapterId: chapter.id,
      isScreenplay: false,
      saveChapter,
      resetReconcile: vi.fn(),
    });

    requestReplace(chapter.id, "nonexistent", "strode");

    await vi.waitFor(() => {
      expect(useEditorStore.getState().stagedEditResults.e1).toBe("failed");
    });
    expect(useEditorStore.getState().pendingStagedEdit).toBeNull();
    expect(editor.getText()).toBe("She walked quickly to the door.");
    expect(saveChapter).not.toHaveBeenCalled();
    const row = await db.chapters.get(chapter.id);
    expect(row?.content).toBe("She walked quickly to the door.");
  });

  it("applies the edit in a screenplay editor via fountain", async () => {
    const chapter = await seed("INT. HOUSE - DAY\n\nShe waits.", true);
    const saveChapter = saveFromEditor(chapter.id, true);
    render({
      editor,
      chapterId: chapter.id,
      isScreenplay: true,
      saveChapter,
      resetReconcile: vi.fn(),
    });

    requestReplace(chapter.id, "waits", "paces");

    expect(editor.getText()).toContain("She paces.");
    await vi.waitFor(() => {
      expect(useEditorStore.getState().stagedEditResults.e1).toBe("applied");
    });
    const row = await db.chapters.get(chapter.id);
    expect(row?.content).toContain("She paces.");
  });

  it("runs a request once even when the effect re-runs mid-apply", async () => {
    const chapter = await seed("She walked quickly to the door.");
    const gate = deferred();
    const first = saveFromEditor(chapter.id, false, gate.promise);
    const second = saveFromEditor(chapter.id, false);
    const base = {
      editor,
      chapterId: chapter.id,
      isScreenplay: false,
      saveChapter: first,
      resetReconcile: vi.fn(),
    };
    const { rerender } = render(base);

    requestReplace(chapter.id, "walked quickly", "strode");
    rerender({ ...base, saveChapter: second });
    gate.resolve();

    await vi.waitFor(() => {
      expect(useEditorStore.getState().stagedEditResults.e1).toBe("applied");
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(editor.getText()).toBe("She strode to the door.");
  });

  it("still reports applied and leaves the document dirty when the save throws", async () => {
    const chapter = await seed("She walked quickly to the door.");
    const saveChapter = vi.fn(async () => {
      throw new Error("disk full");
    });
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    render({
      editor,
      chapterId: chapter.id,
      isScreenplay: false,
      saveChapter,
      resetReconcile: vi.fn(),
    });

    requestReplace(chapter.id, "walked quickly", "strode");

    await vi.waitFor(() => {
      expect(useEditorStore.getState().stagedEditResults.e1).toBe("applied");
    });
    expect(editor.getText()).toBe("She strode to the door.");
    expect(useEditorStore.getState().isDirty).toBe(true);
    expect(useEditorStore.getState().saveStatus).toBe("error");
    warn.mockRestore();
  });
});
