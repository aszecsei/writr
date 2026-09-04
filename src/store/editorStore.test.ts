import { beforeEach, describe, expect, it } from "vitest";
import type { ChapterId } from "@/db/schemas";
import { useEditorStore } from "./editorStore";

function getState() {
  return useEditorStore.getState();
}

const DOC_1 = "doc-1" as ChapterId;

describe("editorStore", () => {
  beforeEach(() => {
    useEditorStore.setState({
      activeDocumentId: null,
      activeDocumentType: null,
      isDirty: false,
      saveStatus: "idle",
      wordCount: 0,
      selectedText: null,
      selectedRange: null,
      contentVersion: 0,
      pendingStagedEdit: null,
      stagedEditResults: {},
    });
  });

  // ─── Initial state ──────────────────────────────────────────────────

  it("has null document and clean state initially", () => {
    const s = getState();
    expect(s.activeDocumentId).toBeNull();
    expect(s.activeDocumentType).toBeNull();
    expect(s.isDirty).toBe(false);
    expect(s.saveStatus).toBe("idle");
  });

  // ─── setActiveDocument ──────────────────────────────────────────────

  it("sets document id and type", () => {
    getState().setActiveDocument(DOC_1, "chapter");
    const s = getState();
    expect(s.activeDocumentId).toBe("doc-1");
    expect(s.activeDocumentType).toBe("chapter");
  });

  it("resets isDirty and saveStatus when setting active document", () => {
    getState().markDirty();
    getState().setActiveDocument(DOC_1, "chapter");
    const s = getState();
    expect(s.isDirty).toBe(false);
    expect(s.saveStatus).toBe("idle");
  });

  // ─── clearActiveDocument ────────────────────────────────────────────

  it("clears document and resets all ephemeral state", () => {
    getState().setActiveDocument(DOC_1, "chapter");
    getState().setWordCount(500);
    getState().setSelection("hello", 1, 6);
    getState().markDirty();

    getState().clearActiveDocument();
    const s = getState();
    expect(s.activeDocumentId).toBeNull();
    expect(s.activeDocumentType).toBeNull();
    expect(s.isDirty).toBe(false);
    expect(s.saveStatus).toBe("idle");
    expect(s.wordCount).toBe(0);
    expect(s.selectedText).toBeNull();
    expect(s.selectedRange).toBeNull();
  });

  // ─── markDirty ──────────────────────────────────────────────────────

  it("sets isDirty and resets saveStatus to idle", () => {
    getState().markSaving();
    getState().markDirty();
    const s = getState();
    expect(s.isDirty).toBe(true);
    expect(s.saveStatus).toBe("idle");
  });

  // ─── Save lifecycle ─────────────────────────────────────────────────

  it("markSaved clears dirty and sets saved status", () => {
    getState().markDirty();
    getState().markSaving();
    getState().markSaved();
    const s = getState();
    expect(s.isDirty).toBe(false);
    expect(s.saveStatus).toBe("saved");
  });

  it("markSaveError sets error status", () => {
    getState().markSaving();
    getState().markSaveError();
    expect(getState().saveStatus).toBe("error");
  });

  // ─── setSelection / clearSelection ──────────────────────────────────

  it("sets selection text and range, then clears both on clearSelection", () => {
    getState().setSelection("hello world", 5, 16);
    const afterSet = getState();
    expect(afterSet.selectedText).toBe("hello world");
    expect(afterSet.selectedRange).toEqual({ from: 5, to: 16 });

    getState().clearSelection();
    const afterClear = getState();
    expect(afterClear.selectedText).toBeNull();
    expect(afterClear.selectedRange).toBeNull();
  });

  // ─── Staged edits (propose_edit Apply) ──────────────────────────────

  it("requestStagedEdit stores the edit including its correlation editId", () => {
    getState().requestStagedEdit({
      editId: "edit-1",
      chapterId: DOC_1,
      kind: "replace",
      anchorText: "old",
      newContent: "new",
    });
    const pending = getState().pendingStagedEdit;
    expect(pending?.editId).toBe("edit-1");
    expect(pending?.chapterId).toBe("doc-1");
    expect(pending?.newContent).toBe("new");
  });

  it("clearPendingStagedEdit removes the pending edit", () => {
    getState().requestStagedEdit({
      editId: "edit-1",
      chapterId: DOC_1,
      kind: "append",
      newContent: "x",
    });
    getState().clearPendingStagedEdit();
    expect(getState().pendingStagedEdit).toBeNull();
  });

  it("reportStagedEditResult records the outcome keyed by editId", () => {
    getState().reportStagedEditResult("edit-1", "applied");
    getState().reportStagedEditResult("edit-2", "failed");
    expect(getState().stagedEditResults).toEqual({
      "edit-1": "applied",
      "edit-2": "failed",
    });
  });

  it("clearStagedEditResult removes only the given editId", () => {
    getState().reportStagedEditResult("edit-1", "applied");
    getState().reportStagedEditResult("edit-2", "failed");
    getState().clearStagedEditResult("edit-1");
    expect(getState().stagedEditResults).toEqual({ "edit-2": "failed" });
  });
});
