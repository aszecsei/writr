import { describe, expect, it } from "vitest";
import {
  assembleSegments,
  mapSegmentsToScenes,
  sceneBreakMarker,
  splitSegments,
} from "./segments";

describe("splitSegments", () => {
  it("returns a single core segment when there are no markers", () => {
    const segs = splitSegments("Just some prose.");
    expect(segs).toEqual([{ markerSceneId: null, body: "Just some prose." }]);
  });

  it("splits at markers and attributes each segment to its preceding marker", () => {
    const content = [
      "Core prose.",
      sceneBreakMarker("s2"),
      "Second scene.",
      sceneBreakMarker("s3"),
      "Third scene.",
    ].join("\n\n");
    const segs = splitSegments(content);
    expect(segs).toEqual([
      { markerSceneId: null, body: "Core prose." },
      { markerSceneId: "s2", body: "Second scene." },
      { markerSceneId: "s3", body: "Third scene." },
    ]);
  });
});

describe("assembleSegments", () => {
  it("emits no marker for the core and a marker before every other scene", () => {
    const md = assembleSegments([
      { sceneId: "core", body: "Core prose." },
      { sceneId: "s2", body: "Second scene." },
    ]);
    expect(md).toBe(
      `Core prose.\n\n${sceneBreakMarker("s2")}\n\nSecond scene.`,
    );
  });

  it("round-trips through split when the first scene keeps its position", () => {
    const original = [
      "Core prose.",
      sceneBreakMarker("s2"),
      "Second scene.",
    ].join("\n\n");
    const mapped = mapSegmentsToScenes(original, ["core", "s2"]);
    expect(assembleSegments(mapped)).toBe(original);
  });
});

describe("mapSegmentsToScenes", () => {
  it("resolves the core segment to the row referenced by no marker", () => {
    const content = `Core.\n\n${sceneBreakMarker("s2")}\n\nSecond.`;
    const mapped = mapSegmentsToScenes(content, ["coreRow", "s2"]);
    expect(mapped).toEqual([
      { sceneId: "coreRow", body: "Core." },
      { sceneId: "s2", body: "Second." },
    ]);
  });

  it("reassembling in a new order promotes a former non-core scene to core", () => {
    const content = `Core.\n\n${sceneBreakMarker("s2")}\n\nSecond.`;
    const mapped = mapSegmentsToScenes(content, ["coreRow", "s2"]);
    // Put s2 first: it loses its marker; the old core gains one.
    const reordered = [mapped[1], mapped[0]];
    expect(assembleSegments(reordered)).toBe(
      `Second.\n\n${sceneBreakMarker("coreRow")}\n\nCore.`,
    );
  });
});
