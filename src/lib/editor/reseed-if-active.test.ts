import { beforeEach, describe, expect, it } from "vitest";
import type { ChapterId } from "@/db/schemas";
import { useEditorStore } from "@/store/editorStore";
import { reseedIfActive } from "./reseed-if-active";

const active = "c1111111-1111-4111-a111-111111111111" as ChapterId;
const other = "c2222222-2222-4222-a222-222222222222" as ChapterId;

describe("reseedIfActive", () => {
  beforeEach(() => {
    useEditorStore.getState().setActiveDocument(active, "chapter");
  });

  it("bumps the content version when the active chapter changed", () => {
    const before = useEditorStore.getState().contentVersion;
    reseedIfActive(other, active);
    expect(useEditorStore.getState().contentVersion).toBe(before + 1);
  });

  it("leaves the content version alone for an inactive chapter", () => {
    const before = useEditorStore.getState().contentVersion;
    reseedIfActive(other);
    expect(useEditorStore.getState().contentVersion).toBe(before);
  });
});
