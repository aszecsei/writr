import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type DocumentType = "chapter" | "worldbuilding" | "style-guide";

interface EditorState {
  activeDocumentId: string | null;
  activeDocumentType: DocumentType | null;
  isDirty: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  wordCount: number;
  selectedText: string | null;
  selectedRange: { from: number; to: number } | null;

  setActiveDocument: (id: string, type: DocumentType) => void;
  clearActiveDocument: () => void;
  markDirty: () => void;
  markSaving: () => void;
  markSaved: () => void;
  markSaveError: () => void;
  setWordCount: (count: number) => void;
  setSelection: (text: string, from: number, to: number) => void;
  clearSelection: () => void;
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
  })),
);
