import { describe, expect, it } from "vitest";
import type { ProposedEdit } from "@/db/schemas";
import { applyEditsToContent } from "./stagedChapterContent";

const ts = "2024-01-01T00:00:00.000Z";

function makeEdit(overrides: Partial<ProposedEdit>): ProposedEdit {
  return {
    id: overrides.id ?? "edit-x",
    projectId: "00000000-0000-4000-8000-000000000001",
    runId: "00000000-0000-4000-8000-000000000002",
    workUnitId: "00000000-0000-4000-8000-000000000003",
    chapterId: "00000000-0000-4000-8000-000000000004",
    kind: "replace",
    newContent: "",
    rationale: "",
    status: "approved",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

describe("applyEditsToContent", () => {
  it("applies a single replace edit using the combined locator", () => {
    const content = "the dog ran swiftly down the road";
    const edit = makeEdit({
      id: "e1",
      kind: "replace",
      anchorText: "ran swiftly down",
      newContent: "tore down",
    });
    const {
      content: out,
      applied,
      skipped,
    } = applyEditsToContent(content, [edit]);
    expect(out).toBe("the dog tore down the road");
    expect(applied).toEqual(["e1"]);
    expect(skipped).toEqual([]);
  });

  it("uses prefix/suffix to disambiguate a repeated anchor", () => {
    const content = "the good dog and the bad dog ran home";
    const edit = makeEdit({
      id: "e1",
      kind: "replace",
      prefix: "the bad ",
      anchorText: "dog",
      suffix: " ran",
      newContent: "wolf",
    });
    const { content: out } = applyEditsToContent(content, [edit]);
    expect(out).toBe("the good dog and the bad wolf ran home");
  });

  it("skips a replace edit when the combined locator is no longer present", () => {
    const content = "completely different prose now";
    const edit = makeEdit({
      id: "e1",
      kind: "replace",
      anchorText: "ran swiftly down",
      newContent: "tore down",
    });
    const {
      content: out,
      applied,
      skipped,
    } = applyEditsToContent(content, [edit]);
    expect(out).toBe(content);
    expect(applied).toEqual([]);
    expect(skipped).toEqual(["e1"]);
  });

  it("applies two replace edits in the same chapter without clobbering each other", () => {
    const content = "alpha beta gamma delta epsilon";
    // Edits supplied in input order — locator decides apply order.
    const editEarly = makeEdit({
      id: "early",
      kind: "replace",
      anchorText: "beta",
      newContent: "BETA",
    });
    const editLate = makeEdit({
      id: "late",
      kind: "replace",
      anchorText: "delta",
      newContent: "DELTA",
    });
    const {
      content: out,
      applied,
      skipped,
    } = applyEditsToContent(content, [editEarly, editLate]);
    expect(out).toBe("alpha BETA gamma DELTA epsilon");
    expect(applied).toContain("early");
    expect(applied).toContain("late");
    expect(skipped).toEqual([]);
  });

  it("applies append + replace together correctly", () => {
    const content = "first sentence.";
    const replaceEdit = makeEdit({
      id: "r",
      kind: "replace",
      anchorText: "first",
      newContent: "First",
    });
    const appendEdit = makeEdit({
      id: "a",
      kind: "append",
      newContent: " Second sentence.",
    });
    const { content: out } = applyEditsToContent(content, [
      replaceEdit,
      appendEdit,
    ]);
    expect(out).toBe("First sentence. Second sentence.");
  });
});
