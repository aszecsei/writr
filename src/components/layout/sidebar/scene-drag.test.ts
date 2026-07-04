import { describe, expect, it } from "vitest";
import type { SceneId } from "@/db/schemas";
import { planSceneReorder } from "./scene-drag";

const ids = (...xs: string[]) => xs as SceneId[];

describe("planSceneReorder", () => {
  it("moves a scene up (before an earlier sibling)", () => {
    expect(
      planSceneReorder(ids("a", "b", "c"), "c" as SceneId, "b" as SceneId),
    ).toEqual(ids("a", "c", "b"));
  });

  it("moves a scene down (before a later sibling)", () => {
    // dropping `a` before `c` lands it between b and c
    expect(
      planSceneReorder(ids("a", "b", "c"), "a" as SceneId, "c" as SceneId),
    ).toEqual(ids("b", "a", "c"));
  });

  it("moves a scene to the end when beforeId is null", () => {
    expect(planSceneReorder(ids("a", "b", "c"), "a" as SceneId, null)).toEqual(
      ids("b", "c", "a"),
    );
  });

  it("can move a scene into the core (position 0) slot", () => {
    expect(
      planSceneReorder(ids("a", "b", "c"), "c" as SceneId, "a" as SceneId),
    ).toEqual(ids("c", "a", "b"));
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
