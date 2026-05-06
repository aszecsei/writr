// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { CollabProseEditor } from "./CollabProseEditor";

function makeDoc(): { doc: Y.Doc; awareness: Awareness } {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  return { doc, awareness };
}

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

describe("CollabProseEditor", () => {
  it("mounts without crashing in editable mode", () => {
    const { doc, awareness } = makeDoc();
    cleanups.push(() => {
      awareness.destroy();
      doc.destroy();
    });
    const { container } = render(
      <CollabProseEditor doc={doc} awareness={awareness} editable={true} />,
    );
    // ProseMirror renders a contenteditable div; in editable mode it should
    // be present with contenteditable="true".
    const ce = container.querySelector("[contenteditable]");
    expect(ce).not.toBeNull();
    expect(ce?.getAttribute("contenteditable")).toBe("true");
  });

  it("mounts in read-only mode with contenteditable=false", () => {
    const { doc, awareness } = makeDoc();
    cleanups.push(() => {
      awareness.destroy();
      doc.destroy();
    });
    const { container } = render(
      <CollabProseEditor doc={doc} awareness={awareness} editable={false} />,
    );
    const ce = container.querySelector("[contenteditable]");
    expect(ce).not.toBeNull();
    expect(ce?.getAttribute("contenteditable")).toBe("false");
  });

  it("reflects pre-existing Y.Doc content when mounted", () => {
    const { doc, awareness } = makeDoc();
    cleanups.push(() => {
      awareness.destroy();
      doc.destroy();
    });
    // Seed the shared XML fragment with text before mount.
    const fragment = doc.getXmlFragment("default");
    const para = new Y.XmlElement("paragraph");
    para.insert(0, [new Y.XmlText("hello world")]);
    fragment.insert(0, [para]);

    const { container } = render(
      <CollabProseEditor doc={doc} awareness={awareness} editable={true} />,
    );
    expect(container.textContent).toContain("hello world");
  });
});
