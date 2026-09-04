import { describe, expect, it } from "vitest";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { createExtensions, createScreenplayExtensions } from "./index";

function names(
  extensions:
    | ReturnType<typeof createExtensions>
    | ReturnType<typeof createScreenplayExtensions>,
): string[] {
  return extensions.map((ext) => ext.name);
}

describe("createExtensions: defaults", () => {
  it("returns the standard prose extension set with no collab additions", () => {
    const exts = createExtensions();
    const ns = names(exts);
    expect(ns).toContain("starterKit");
    expect(ns).toContain("markdown");
    expect(ns).toContain("comments");
    expect(ns).toContain("spellcheck");
    expect(ns).not.toContain("collaboration");
    expect(ns).not.toContain("collaborationCaret");
  });

  it("uses the builtin Selection extension plus the slim SelectionReporter, for both prose and screenplay", () => {
    for (const ns of [
      names(createExtensions()),
      names(createScreenplayExtensions()),
    ]) {
      expect(ns).toContain("selection");
      expect(ns).toContain("selectionReporter");
    }
  });
});

describe("createExtensions: collab option", () => {
  it("appends Collaboration and CollaborationCaret when collab is provided", () => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    try {
      const exts = createExtensions({
        collab: {
          doc,
          awareness,
          userName: "Alice",
          userColor: "#ff5577",
        },
      });
      const ns = names(exts);
      // The caret extension must appear after the Collaboration one so its
      // plugin can defer to Y-bound state.
      expect(ns.indexOf("collaboration")).toBeLessThan(
        ns.indexOf("collaborationCaret"),
      );
    } finally {
      awareness.destroy();
      doc.destroy();
    }
  });
});
