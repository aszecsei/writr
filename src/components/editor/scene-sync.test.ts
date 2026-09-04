// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createExtensions } from "./extensions";
import { activeSceneAt, planSceneReconcile } from "./scene-sync";

describe("planSceneReconcile", () => {
  it("keeps the existing core and orders core-first, markers in doc order", () => {
    const plan = planSceneReconcile(
      ["m1", "m2"],
      [
        { id: "core", order: 0 },
        { id: "m1", order: 1 },
        { id: "m2", order: 2 },
      ],
      () => "should-not-be-called",
    );
    expect(plan.coreId).toBe("core");
    expect(plan.toCreate).toEqual([]);
    expect(plan.toDelete).toEqual([]);
    expect(plan.orderedIds).toEqual(["core", "m1", "m2"]);
  });

  it("creates a row for a new marker", () => {
    const plan = planSceneReconcile(
      ["m1", "m2"],
      [
        { id: "core", order: 0 },
        { id: "m1", order: 1 },
      ],
      () => "core-fallback",
    );
    expect(plan.toCreate).toEqual(["m2"]);
    expect(plan.orderedIds).toEqual(["core", "m1", "m2"]);
  });

  it("deletes an orphaned row whose marker was removed (keeps core)", () => {
    // m2's marker is gone from the doc; its row becomes a coreless orphan.
    const plan = planSceneReconcile(
      ["m1"],
      [
        { id: "core", order: 0 },
        { id: "m1", order: 1 },
        { id: "m2", order: 2 },
      ],
      () => "unused",
    );
    expect(plan.coreId).toBe("core");
    expect(plan.toDelete).toEqual(["m2"]);
    expect(plan.orderedIds).toEqual(["core", "m1"]);
  });

  it("mints a core when no coreless row exists", () => {
    const plan = planSceneReconcile(
      ["m1"],
      [{ id: "m1", order: 0 }],
      () => "minted-core",
    );
    expect(plan.coreId).toBe("minted-core");
    expect(plan.toCreate).toContain("minted-core");
    expect(plan.orderedIds).toEqual(["minted-core", "m1"]);
  });
});

describe("activeSceneAt", () => {
  function editorWithBreak() {
    const editor = new Editor({ extensions: createExtensions(), content: "" });
    editor.commands.setContent(
      "<p>Core scene.</p><p>Also core.</p><p>Second scene.</p>",
    );
    // Insert a break at the end of the second paragraph.
    // "Core scene." (11) + "Also core." (10) → boundary after para 2.
    editor.commands.setTextSelection(24);
    editor.commands.insertSceneBreak("scene-2");
    return editor;
  }

  it.each([
    {
      desc: "before the first marker",
      getPosition: () => 2, // inside "Core scene."
      expected: "core",
    },
    {
      desc: "after the marker",
      getPosition: (editor: Editor) => editor.state.doc.content.size - 2,
      expected: "scene-2",
    },
  ])(
    "returns the active scene id when the caret is $desc",
    ({ getPosition, expected }) => {
      const editor = editorWithBreak();
      editor.commands.setTextSelection(getPosition(editor));
      expect(activeSceneAt(editor, ["core", "scene-2"])).toBe(expected);
      editor.destroy();
    },
  );

  it("returns null when there are no scenes loaded", () => {
    const editor = editorWithBreak();
    expect(activeSceneAt(editor, [])).toBeNull();
    editor.destroy();
  });
});
