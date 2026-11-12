// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createExtensions,
  createScreenplayExtensions,
} from "@/components/editor/extensions";
import { db } from "@/db/database";
import { updateChapterContent } from "@/db/operations/chapters";
import type { ChapterId, ProjectId } from "@/db/schemas";
import { DEFAULT_HOLE_DELIMITERS } from "@/lib/holes";
import { tokenizeText } from "@/lib/text-analysis/repeats/tokenize";
import { makeChapter, resetIdCounter } from "@/test/helpers";
import { type UseEditorSeedOptions, useEditorSeed } from "./useEditorSeed";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;

let editor: Editor;

function makeOptions(
  overrides: Partial<UseEditorSeedOptions> & { chapterId: ChapterId },
): UseEditorSeedOptions {
  return {
    editor,
    isScreenplay: false,
    collabDoc: null,
    isCollabHost: false,
    contentVersion: 0,
    scenes: [],
    pendingSceneScroll: null,
    clearSceneScroll: vi.fn(),
    pendingPassageReveal: null,
    clearPassageReveal: vi.fn(),
    holeDelimitersRef: { current: DEFAULT_HOLE_DELIMITERS },
    setWordCount: vi.fn(),
    initializedRef: { current: false },
    resetReconcile: vi.fn(),
    ...overrides,
  };
}

async function seedChapter(content: string) {
  const chapter = makeChapter({ projectId, title: "Ch", content });
  await db.chapters.add(chapter);
  return chapter;
}

beforeEach(async () => {
  resetIdCounter();
  await db.chapters.clear();
  editor = new Editor({ extensions: createExtensions(), content: "" });
});

afterEach(() => {
  editor.destroy();
});

describe("useEditorSeed", () => {
  it("seeds a newly opened chapter from its stored row", async () => {
    const chapter = await seedChapter("Alpha paragraph.");
    const options = makeOptions({ chapterId: chapter.id });

    renderHook(() => useEditorSeed(options));

    await vi.waitFor(() => {
      expect(editor.getText()).toContain("Alpha paragraph.");
    });
    expect(options.initializedRef.current).toBe(true);
    expect(options.setWordCount).toHaveBeenCalledWith(2);
    expect(options.resetReconcile).toHaveBeenCalledTimes(1);
  });

  it("reseeds from the stored row after a version bump", async () => {
    const chapter = await seedChapter("Alpha paragraph.");
    const base = makeOptions({ chapterId: chapter.id });
    const { rerender } = renderHook(
      (props: UseEditorSeedOptions) => useEditorSeed(props),
      { initialProps: base },
    );
    await vi.waitFor(() => {
      expect(editor.getText()).toContain("Alpha");
    });

    await updateChapterContent(chapter.id, "Beta paragraph.", 2);
    rerender({ ...base, contentVersion: 1 });

    await vi.waitFor(() => {
      expect(editor.getText()).toContain("Beta");
    });
    expect(editor.getText()).not.toContain("Alpha");
    expect(base.initializedRef.current).toBe(true);
    expect(base.resetReconcile).toHaveBeenCalledTimes(2);
  });

  it("keeps unsaved editor edits when re-rendered without a version bump", async () => {
    const chapter = await seedChapter("Alpha paragraph.");
    const base = makeOptions({ chapterId: chapter.id });
    const { rerender } = renderHook(
      (props: UseEditorSeedOptions) => useEditorSeed(props),
      { initialProps: base },
    );
    await vi.waitFor(() => {
      expect(editor.getText()).toContain("Alpha");
    });

    editor.commands.insertContentAt(1, "TYPED ");
    // Simulates the live query re-emitting the row (e.g. after an autosave).
    rerender({ ...base });
    await Promise.resolve();

    expect(editor.getText()).toContain("TYPED Alpha");
    expect(base.setWordCount).toHaveBeenCalledTimes(1);
  });

  it("seeds a screenplay chapter through the fountain parser", async () => {
    editor.destroy();
    editor = new Editor({
      extensions: createScreenplayExtensions(),
      content: "",
    });
    const chapter = await seedChapter("INT. HOUSE - DAY\n\nShe waits.");
    const options = makeOptions({ chapterId: chapter.id, isScreenplay: true });

    renderHook(() => useEditorSeed(options));

    await vi.waitFor(() => {
      expect(editor.getText()).toContain("She waits.");
    });
    expect(editor.state.doc.firstChild?.type.name).toBe("sceneHeading");
  });

  describe("passage reveal", () => {
    const anchor = {
      tokens: tokenizeText("the gale came howling").map((t) => t.word),
      occurrence: 0,
    };

    function selectedText() {
      const { from, to } = editor.state.selection;
      return editor.state.doc.textBetween(from, to);
    }

    it("selects a passage requested for this chapter once seeded, then clears the request", async () => {
      const chapter = await seedChapter("At dusk the gale came howling in.");
      const options = makeOptions({
        chapterId: chapter.id,
        pendingPassageReveal: { chapterId: chapter.id, anchor },
      });

      renderHook(() => useEditorSeed(options));

      await vi.waitFor(() => {
        expect(options.clearPassageReveal).toHaveBeenCalled();
      });
      expect(selectedText()).toBe("the gale came howling");
    });

    it("leaves a reveal meant for another chapter pending", async () => {
      const chapter = await seedChapter("At dusk the gale came howling in.");
      const options = makeOptions({
        chapterId: chapter.id,
        pendingPassageReveal: {
          chapterId: "b9999999-9999-4999-a999-999999999999" as ChapterId,
          anchor,
        },
      });

      renderHook(() => useEditorSeed(options));

      await vi.waitFor(() => {
        expect(options.initializedRef.current).toBe(true);
      });
      expect(options.clearPassageReveal).not.toHaveBeenCalled();
    });

    it("selects a passage requested while the chapter is already open", async () => {
      const chapter = await seedChapter("At dusk the gale came howling in.");
      const base = makeOptions({ chapterId: chapter.id });
      const { rerender } = renderHook(
        (props: UseEditorSeedOptions) => useEditorSeed(props),
        { initialProps: base },
      );
      await vi.waitFor(() => {
        expect(base.initializedRef.current).toBe(true);
      });

      rerender({
        ...base,
        pendingPassageReveal: { chapterId: chapter.id, anchor },
      });

      expect(base.clearPassageReveal).toHaveBeenCalled();
      expect(selectedText()).toBe("the gale came howling");
    });
  });
});
