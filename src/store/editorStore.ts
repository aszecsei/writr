import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  ChapterId,
  StyleGuideEntryId,
  WorldbuildingDocId,
} from "@/db/schemas";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type DocumentType = "chapter" | "worldbuilding" | "style-guide";

/**
 * The id of the active document, branded by its document type. Consumers
 * narrow via `activeDocumentType` to read the id with the correct brand —
 * the union members are pairwise distinct.
 */
export type ActiveDocumentId =
  | ChapterId
  | WorldbuildingDocId
  | StyleGuideEntryId;

/**
 * Cross-component editor command. The AI panel posts these via
 * `requestInsertAtCursor` so the active TipTap editor (held as a ref inside
 * ChapterEditor) can apply them. The editor consumes the command and clears
 * it. Selection-based commands embed the range directly so the consumer
 * doesn't have to read from elsewhere on a stale closure.
 */
export interface PendingInsertion {
  /** Markdown to insert. Converted to ProseMirror nodes by the consumer. */
  markdown: string;
  /**
   * When set, replace this range. Otherwise insert at the current cursor.
   * Captured at submit time so a later cursor move doesn't change the target.
   */
  replaceRange?: { from: number; to: number };
}

/**
 * A staged edit dispatched from a chat-mode propose_edit tool call. Distinct
 * from PendingInsertion because the apply site is anchorText-located rather
 * than range-located — the resolution from anchor to PM positions happens in
 * the editor consumer, which has access to the live TipTap doc.
 */
export interface PendingStagedEdit {
  /**
   * Correlation id so the dispatching card can observe the apply outcome via
   * `stagedEditResults[editId]` — the consumer runs asynchronously in
   * ChapterEditor, so the card can't learn success/failure from the call site.
   */
  editId: string;
  /** Safety check: edit applies only when this matches activeDocumentId. */
  chapterId: ChapterId;
  kind: "replace" | "insert_at" | "append" | "full_chapter";
  /** Required for replace / insert_at. Matched verbatim against the doc text. */
  anchorText?: string;
  /**
   * `replace` only — verbatim disambiguation context. The editor consumer
   * locates `prefix + anchorText + suffix` in the doc, then narrows to the
   * anchorText slice for the splice.
   */
  prefix?: string;
  suffix?: string;
  /** Markdown to insert / replace with. */
  newContent: string;
}

interface EditorState {
  activeDocumentId: ActiveDocumentId | null;
  activeDocumentType: DocumentType | null;
  isDirty: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  wordCount: number;
  selectedText: string | null;
  selectedRange: { from: number; to: number } | null;
  contentVersion: number;
  pendingInsertion: PendingInsertion | null;
  pendingStagedEdit: PendingStagedEdit | null;
  /**
   * Outcome of each dispatched staged edit, keyed by `editId`. The consumer
   * (ChapterEditor) writes here after attempting the apply; the originating
   * ProposedEditCard reads it to show Applied / Failed, then clears it.
   */
  stagedEditResults: Record<string, "applied" | "failed">;

  setActiveDocument: (id: ActiveDocumentId, type: DocumentType) => void;
  clearActiveDocument: () => void;
  markDirty: () => void;
  markSaving: () => void;
  markSaved: () => void;
  markSaveError: () => void;
  setWordCount: (count: number) => void;
  setSelection: (text: string, from: number, to: number) => void;
  clearSelection: () => void;
  bumpContentVersion: () => void;
  requestInsertAtCursor: (insertion: PendingInsertion) => void;
  clearPendingInsertion: () => void;
  requestStagedEdit: (edit: PendingStagedEdit) => void;
  clearPendingStagedEdit: () => void;
  reportStagedEditResult: (
    editId: string,
    result: "applied" | "failed",
  ) => void;
  clearStagedEditResult: (editId: string) => void;
}

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
    activeDocumentId: null,
    activeDocumentType: null,
    isDirty: false,
    saveStatus: "idle",
    lastSavedAt: null,
    wordCount: 0,
    selectedText: null,
    selectedRange: null,
    contentVersion: 0,
    pendingInsertion: null,
    pendingStagedEdit: null,
    stagedEditResults: {},

    setActiveDocument: (id, type) =>
      set((s) => {
        s.activeDocumentId = id;
        s.activeDocumentType = type;
        s.isDirty = false;
        s.saveStatus = "idle";
      }),

    clearActiveDocument: () =>
      set((s) => {
        s.activeDocumentId = null;
        s.activeDocumentType = null;
        s.isDirty = false;
        s.saveStatus = "idle";
        s.wordCount = 0;
        s.selectedText = null;
        s.selectedRange = null;
      }),

    markDirty: () =>
      set((s) => {
        s.isDirty = true;
        s.saveStatus = "idle";
      }),

    markSaving: () =>
      set((s) => {
        s.saveStatus = "saving";
      }),

    markSaved: () =>
      set((s) => {
        s.isDirty = false;
        s.saveStatus = "saved";
        s.lastSavedAt = new Date().toISOString();
      }),

    markSaveError: () =>
      set((s) => {
        s.saveStatus = "error";
      }),

    setWordCount: (count) =>
      set((s) => {
        s.wordCount = count;
      }),

    setSelection: (text, from, to) =>
      set((s) => {
        s.selectedText = text;
        s.selectedRange = { from, to };
      }),

    clearSelection: () =>
      set((s) => {
        s.selectedText = null;
        s.selectedRange = null;
      }),

    bumpContentVersion: () =>
      set((s) => {
        s.contentVersion += 1;
      }),

    requestInsertAtCursor: (insertion) =>
      set((s) => {
        s.pendingInsertion = insertion;
      }),

    clearPendingInsertion: () =>
      set((s) => {
        s.pendingInsertion = null;
      }),

    requestStagedEdit: (edit) =>
      set((s) => {
        s.pendingStagedEdit = edit;
      }),

    clearPendingStagedEdit: () =>
      set((s) => {
        s.pendingStagedEdit = null;
      }),

    reportStagedEditResult: (editId, result) =>
      set((s) => {
        s.stagedEditResults[editId] = result;
      }),

    clearStagedEditResult: (editId) =>
      set((s) => {
        delete s.stagedEditResults[editId];
      }),
  })),
);

// ─── Typed selectors ────────────────────────────────────────────────
//
// `activeDocumentId` and `activeDocumentType` are coupled — the id's brand
// matches the type. These selectors do the discriminator check once so
// consumers can read a typed id without a cast.

export const selectActiveChapterId = (s: EditorState): ChapterId | null =>
  s.activeDocumentType === "chapter" ? (s.activeDocumentId as ChapterId) : null;

export const selectActiveWorldbuildingDocId = (
  s: EditorState,
): WorldbuildingDocId | null =>
  s.activeDocumentType === "worldbuilding"
    ? (s.activeDocumentId as WorldbuildingDocId)
    : null;

export const selectActiveStyleGuideEntryId = (
  s: EditorState,
): StyleGuideEntryId | null =>
  s.activeDocumentType === "style-guide"
    ? (s.activeDocumentId as StyleGuideEntryId)
    : null;
