import { describe, expect, it } from "vitest";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { createExtensions } from "./index";

function names(extensions: ReturnType<typeof createExtensions>): string[] {
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
      expect(ns).toContain("collaboration");
      expect(ns).toContain("collaborationCaret");
      // The caret extension should appear after the Collaboration one
      // so its plugin can defer to Y-bound state.
      expect(ns.indexOf("collaboration")).toBeLessThan(
        ns.indexOf("collaborationCaret"),
      );
    } finally {
      awareness.destroy();
      doc.destroy();
    }
  });

  it("threads the doc and awareness through the extension config", () => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    try {
      const exts = createExtensions({
        collab: { doc, awareness },
      });
      const collab = exts.find((e) => e.name === "collaboration") as
        | { options: { document: Y.Doc } }
        | undefined;
      expect(collab?.options.document).toBe(doc);

      const caret = exts.find((e) => e.name === "collaborationCaret") as
        | { options: { provider: { awareness: Awareness } } }
        | undefined;
      expect(caret?.options.provider.awareness).toBe(awareness);
    } finally {
      awareness.destroy();
      doc.destroy();
    }
  });

  it("falls back to default user name + color when not provided", () => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    try {
      const exts = createExtensions({ collab: { doc, awareness } });
      const caret = exts.find((e) => e.name === "collaborationCaret") as
        | { options: { user: { name: string; color: string } } }
        | undefined;
      expect(caret?.options.user.name).toBe("Host");
      expect(caret?.options.user.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    } finally {
      awareness.destroy();
      doc.destroy();
    }
  });
});
