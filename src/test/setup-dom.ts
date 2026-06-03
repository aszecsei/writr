import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Tear down any rendered DOM between tests so getByText / getByRole queries
// don't accidentally match nodes left by a prior test in the same file.
afterEach(() => {
  cleanup();
});

// @tiptap/extensions' viewport-tracking Placeholder plugin calls
// view.posAtCoords() on editor mount, which dispatches to
// document.elementFromPoint — unimplemented in jsdom. Returning null is the
// correct "no element here" signal; prosemirror-view degrades to a
// full-document viewport range, which is fine for tests that mount an editor.
// Guarded because this setup file also loads under the node environment, where
// `document` is undefined.
if (typeof document !== "undefined" && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}
