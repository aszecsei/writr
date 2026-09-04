import { describe, expect, it } from "vitest";
import type { SceneId } from "@/db/schemas";
import { planSceneReorder } from "./scene-drag";

const ids = (...xs: string[]) => xs as SceneId[];

describe("planSceneReorder", () => {
  it.each([
    {
      desc: "up (before an earlier sibling)",
      moved: "c",
      before: "b",
      expected: ids("a", "c", "b"),
    },
    {
      desc: "down (before a later sibling)",
      moved: "a",
      before: "c",
      expected: ids("b", "a", "c"),
    },
  ])("moves a scene $desc", ({ moved, before, expected }) => {
    expect(
      planSceneReorder(ids("a", "b", "c"), moved as SceneId, before as SceneId),
    ).toEqual(expected);
  });

  it.each([
    {
      desc: "moves a scene to the end when beforeId is null",
      moved: "a",
      before: null,
      expected: ids("b", "c", "a"),
    },
    {
      desc: "can move a scene into the core (position 0) slot",
      moved: "c",
      before: "a",
      expected: ids("c", "a", "b"),
    },
  ])("$desc", ({ moved, before, expected }) => {
    expect(
      planSceneReorder(
        ids("a", "b", "c"),
        moved as SceneId,
        before as SceneId | null,
      ),
    ).toEqual(expected);
  });

  it("returns null when dropping a scene onto itself", () => {
    expect(
      planSceneReorder(ids("a", "b", "c"), "b" as SceneId, "b" as SceneId),
    ).toBeNull();
  });

  it("returns null when the resulting order is unchanged", () => {
    // `a` is already immediately before `b`
    expect(
      planSceneReorder(ids("a", "b", "c"), "a" as SceneId, "b" as SceneId),
    ).toBeNull();
    // moving the last scene to the end is a no-op
    expect(
      planSceneReorder(ids("a", "b", "c"), "c" as SceneId, null),
    ).toBeNull();
  });

  it("returns null for a stale/unknown before id", () => {
    expect(
      planSceneReorder(ids("a", "b", "c"), "a" as SceneId, "z" as SceneId),
    ).toBeNull();
  });

  it("returns null when the moved id is not in the list", () => {
    expect(
      planSceneReorder(ids("a", "b", "c"), "z" as SceneId, "b" as SceneId),
    ).toBeNull();
  });
});
