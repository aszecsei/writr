import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ChapterId, ProjectId } from "@/db/schemas";

export type SidebarPanel = "chapters" | "bible" | "agents";

/** The tabs of the combined right-hand panel. Only one is visible at a time. */
export type RightPanelTab = "ai" | "analysis" | "details";

// Discriminated union for modal state - provides type safety at call sites
type ModalState =
  | { id: null }
  | {
      id: "create-project";
      // Optional seed values (e.g. opened from the brainstorm page with a
      // generated idea as the description).
      prefill?: { title?: string; description?: string };
    }
  | { id: "edit-project"; projectId: ProjectId }
  | { id: "delete-project"; projectId: ProjectId }
  | { id: "project-settings" }
  | { id: "app-settings" }
  | {
      id: "export";
      projectId: ProjectId;
      chapterId?: ChapterId;
      scope?: "book" | "chapter";
    }
  | {
      id: "preview-card";
      selectedHtml: string;
      projectTitle: string;
      chapterTitle: string;
    }
  | { id: "link-editor"; currentHref?: string }
  | { id: "insert-image" }
  | { id: "ruby-editor"; currentAnnotation?: string }
  | { id: "dictionary-manager" }
  | { id: "grammar-rules" }
  | { id: "version-history"; chapterId: ChapterId; projectId: ProjectId }
  | { id: "chapter-properties"; chapterId: ChapterId }
  | { id: "separator-settings"; chapterId: ChapterId }
  | { id: "saved-prompts" }
  | { id: "shortcuts-help" }
  | { id: "share-collab-session" }
  | {
      id: "collab-approve-join";
      requestId: string;
      displayName: string;
      color: string;
    }
  | { id: "collab-manage-participants" }
  | { id: "spellcheck-scanner" }
  | { id: "grammar-scanner" };

export type ModalId = ModalState["id"];

interface UiState {
  sidebarOpen: boolean;
  sidebarPanel: SidebarPanel;
  modal: ModalState;
  /**
   * The combined right-hand panel (AI / Analysis / Details). One tab visible at
   * a time; `open` gates the whole panel. Toggled from the TopBar tab buttons.
   */
  rightPanel: { open: boolean; tab: RightPanelTab };
  /**
   * Editor sentence-length highlighting, driven by the analysis panel's
   * "Preview" toggle. Deliberately ephemeral — a visualization mode, not a
   * document setting.
   */
  sentenceLengthPreviewEnabled: boolean;
  focusModeEnabled: boolean;
  /**
   * Monotonic counter bumped to request focusing the global search input. The
   * search input lives in `SearchBar`, which can't be focused declaratively
   * from the shortcut layer, so the `Mod+K` command increments this token and
   * SearchBar focuses itself in response.
   */
  searchFocusToken: number;
  /**
   * Ephemeral binder collapse state, keyed by chapter id. Absent / `true` means
   * expanded; an explicit `false` collapses that node. Not persisted — binder
   * structure lives in Dexie, only this view state is transient.
   */
  collapsedChapters: Record<string, boolean>;
  /**
   * Which chapters are "open" in the binder, showing their scene rows. Default
   * closed (absent / `false`); an explicit `true` reveals a chapter's scenes.
   * Distinct from `collapsedChapters` (which drives binder nesting).
   */
  openChapters: Record<string, boolean>;

  toggleSidebar: () => void;
  setSidebarPanel: (panel: SidebarPanel) => void;
  openModal: <T extends ModalState>(modal: T) => void;
  closeModal: () => void;
  /** Open the panel on `tab`, switching tabs if already open. */
  openRightPanel: (tab: RightPanelTab) => void;
  /** Toggle: same tab closes the panel; a different tab switches to it. */
  toggleRightPanelTab: (tab: RightPanelTab) => void;
  /** Toggle the panel open/closed, keeping the current tab. */
  toggleRightPanel: () => void;
  closeRightPanel: () => void;
  setSentenceLengthPreview: (enabled: boolean) => void;
  toggleFocusMode: () => void;
  setFocusMode: (enabled: boolean) => void;
  requestSearchFocus: () => void;
  toggleChapterCollapsed: (chapterId: string) => void;
  setChapterCollapsed: (chapterId: string, collapsed: boolean) => void;
  toggleChapterOpen: (chapterId: string) => void;
  setChapterOpen: (chapterId: string, open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  immer((set) => ({
    sidebarOpen: true,
    sidebarPanel: "chapters",
    modal: { id: null },
    rightPanel: { open: false, tab: "details" },
    sentenceLengthPreviewEnabled: false,
    focusModeEnabled: false,
    searchFocusToken: 0,
    collapsedChapters: {},
    openChapters: {},

    toggleSidebar: () =>
      set((s) => {
        s.sidebarOpen = !s.sidebarOpen;
      }),

    setSidebarPanel: (panel) =>
      set((s) => {
        s.sidebarPanel = panel;
      }),

    openModal: (modal) =>
      set((s) => {
        s.modal = modal;
      }),

    closeModal: () =>
      set((s) => {
        s.modal = { id: null };
      }),

    openRightPanel: (tab) =>
      set((s) => {
        s.rightPanel = { open: true, tab };
      }),

    toggleRightPanelTab: (tab) =>
      set((s) => {
        if (s.rightPanel.open && s.rightPanel.tab === tab) {
          s.rightPanel.open = false;
        } else {
          s.rightPanel = { open: true, tab };
        }
      }),

    toggleRightPanel: () =>
      set((s) => {
        s.rightPanel.open = !s.rightPanel.open;
      }),

    closeRightPanel: () =>
      set((s) => {
        s.rightPanel.open = false;
      }),

    setSentenceLengthPreview: (enabled) =>
      set((s) => {
        s.sentenceLengthPreviewEnabled = enabled;
      }),

    toggleFocusMode: () =>
      set((s) => {
        s.focusModeEnabled = !s.focusModeEnabled;
      }),

    setFocusMode: (enabled) =>
      set((s) => {
        s.focusModeEnabled = enabled;
      }),

    requestSearchFocus: () =>
      set((s) => {
        s.searchFocusToken += 1;
      }),

    toggleChapterCollapsed: (chapterId) =>
      set((s) => {
        s.collapsedChapters[chapterId] = !s.collapsedChapters[chapterId];
      }),

    setChapterCollapsed: (chapterId, collapsed) =>
      set((s) => {
        s.collapsedChapters[chapterId] = collapsed;
      }),

    toggleChapterOpen: (chapterId) =>
      set((s) => {
        s.openChapters[chapterId] = !s.openChapters[chapterId];
      }),

    setChapterOpen: (chapterId, open) =>
      set((s) => {
        s.openChapters[chapterId] = open;
      }),
  })),
);

// Type guard factory for narrowing modal state by id
function createModalGuard<Id extends ModalId>(id: Id) {
  return (modal: ModalState): modal is Extract<ModalState, { id: Id }> =>
    modal.id === id;
}

export const isEditProjectModal = createModalGuard("edit-project");
export const isDeleteProjectModal = createModalGuard("delete-project");
export const isExportModal = createModalGuard("export");
export const isPreviewCardModal = createModalGuard("preview-card");
export const isLinkEditorModal = createModalGuard("link-editor");
export const isRubyEditorModal = createModalGuard("ruby-editor");
export const isVersionHistoryModal = createModalGuard("version-history");
export const isChapterPropertiesModal = createModalGuard("chapter-properties");
export const isSeparatorSettingsModal = createModalGuard("separator-settings");
export const isCollabApproveJoinModal = createModalGuard("collab-approve-join");
export const isCollabManageParticipantsModal = createModalGuard(
  "collab-manage-participants",
);
export const isSpellcheckScannerModal = createModalGuard("spellcheck-scanner");
export const isGrammarScannerModal = createModalGuard("grammar-scanner");
