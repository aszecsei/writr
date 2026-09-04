"use client";

import { generateHTML } from "@tiptap/core";
import { type Editor, useEditorState } from "@tiptap/react";
import {
  Brackets,
  Download,
  History,
  ImagePlus,
  Maximize2,
  PanelRight,
  ScanSearch,
  SpellCheck,
  SpellCheck2,
  TextSearch,
  Volume2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback } from "react";
import { ShareSessionButton } from "@/components/collab/ShareSessionButton";
import { ToolbarButton } from "@/components/ui/ToolbarButton";
import { ToolbarSeparator } from "@/components/ui/ToolbarSeparator";
import { updateAppSettings } from "@/db/operations";
import type { ChapterId, ProjectId } from "@/db/schemas";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { useChapter } from "@/hooks/data/useChapter";
import { extractReadAloudText } from "@/lib/tts/extract";
import { useCommentStore } from "@/store/commentStore";
import { selectActiveChapterId, useEditorStore } from "@/store/editorStore";
import { useGrammarStore } from "@/store/grammarStore";
import { useProjectStore } from "@/store/projectStore";
import { useSpellcheckStore } from "@/store/spellcheckStore";
import { useTtsStore } from "@/store/ttsStore";
import { useUiStore } from "@/store/uiStore";
import { AlignmentDropdown } from "./AlignmentDropdown";
import { CopyMenu } from "./CopyMenu";
import { CreateCommentButton } from "./comments";
import { getGrammarResults } from "./extensions/Grammar";
import { getSpellcheckResults } from "./extensions/Spellcheck";
import { FontSelector } from "./FontSelector";
import { FontSizeSelector } from "./FontSizeSelector";
import { InsertImageDialog } from "./InsertImageDialog";
import { LinkEditorDialog } from "./LinkEditorDialog";
import { RubyDialog } from "./RubyDialog";
import { TextToolsMenu } from "./TextToolsMenu";
import { actions, groups, type ToolbarActionModal } from "./toolbar-actions";

interface SharedChapterActionsProps {
  editor: Editor;
  projectId: ProjectId | null;
  chapterId: ChapterId | null;
  onToggleFocusMode: () => void;
  /** Rendered immediately before the Copy menu. */
  beforeCopy?: ReactNode;
  /** Rendered immediately after the Copy menu, before the next separator. */
  afterCopy?: ReactNode;
  /** Rendered immediately after the spellcheck scanner button. */
  afterSpellcheck?: ReactNode;
}

/**
 * Project/chapter-scoped toolbar actions shared by EditorToolbar and
 * ScreenplayToolbar: export, version history, copy, comments, spellcheck,
 * and focus mode. The `before*`/`after*` slots let each toolbar interleave
 * its own extra actions without reshuffling the shared ones.
 */
export function SharedChapterActions({
  editor,
  projectId,
  chapterId,
  onToggleFocusMode,
  beforeCopy,
  afterCopy,
  afterSpellcheck,
}: SharedChapterActionsProps) {
  const openModal = useUiStore((s) => s.openModal);
  const marginVisible = useCommentStore((s) => s.marginVisible);
  const toggleMargin = useCommentStore((s) => s.toggleMargin);
  const spellcheckEnabled = useSpellcheckStore((s) => s.enabled);
  const toggleSpellcheck = useSpellcheckStore((s) => s.toggleEnabled);
  const openScanner = useSpellcheckStore((s) => s.openScanner);

  const handleOpenScanner = useCallback(() => {
    const results = getSpellcheckResults(editor.state);
    openScanner(results);
    openModal({ id: "spellcheck-scanner" });
  }, [editor, openScanner, openModal]);

  return (
    <>
      {projectId && chapterId && (
        <>
          <ToolbarSeparator />
          <ToolbarButton
            icon={Download}
            title="Export"
            onClick={() =>
              openModal({
                id: "export",
                projectId,
                chapterId,
                scope: "chapter",
              })
            }
          />
          <ToolbarButton
            icon={History}
            title="Version history"
            onClick={() =>
              openModal({
                id: "version-history",
                chapterId,
                projectId,
              })
            }
          />
          {beforeCopy}
          <CopyMenu projectId={projectId} chapterId={chapterId} />
          {afterCopy}
          <ToolbarSeparator />
          <CreateCommentButton editor={editor} />
          <ToolbarButton
            icon={PanelRight}
            title="Toggle comment margin"
            onClick={toggleMargin}
            variant={marginVisible ? "active" : "default"}
          />
          <ToolbarSeparator />
          <ToolbarButton
            icon={SpellCheck}
            title="Toggle spellcheck"
            onClick={toggleSpellcheck}
            variant={spellcheckEnabled ? "active" : "default"}
          />
          <ToolbarButton
            icon={ScanSearch}
            title="Open spellcheck scanner"
            onClick={handleOpenScanner}
            disabled={!spellcheckEnabled}
          />
          {afterSpellcheck}
        </>
      )}
      <ToolbarSeparator />
      <ToolbarButton
        icon={Maximize2}
        title="Focus mode (Ctrl+Shift+F)"
        onClick={onToggleFocusMode}
      />
    </>
  );
}

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const settings = useAppSettings();
  const currentFont = settings?.editorFont ?? "literata";
  const openModal = useUiStore((s) => s.openModal);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const activeDocumentId = useEditorStore(selectActiveChapterId);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProjectTitle = useProjectStore((s) => s.activeProjectTitle);

  // Grammar checking — enabled state is persisted in AppSettings.
  const grammarEnabled = settings?.grammarCheckerEnabled ?? false;
  const openGrammarScanner = useGrammarStore((s) => s.openScanner);

  const chapter = useChapter(activeDocumentId);

  const ttsState = useTtsStore((s) => s.state);
  const ttsChapterId = useTtsStore((s) => s.chapterId);
  const startReadAloud = useTtsStore((s) => s.startReadAloud);

  const ttsModel = settings?.providerTtsModels?.openrouter ?? "";
  const ttsVoice = settings?.providerTtsVoices?.openrouter ?? "";
  const ttsApiKey = settings?.providerApiKeys?.openrouter ?? "";
  const canReadAloud =
    !!settings?.enableAiFeatures &&
    settings.aiProvider === "openrouter" &&
    ttsModel.trim().length > 0 &&
    ttsVoice.trim().length > 0 &&
    ttsApiKey.trim().length > 0;

  const readAloudLoading =
    ttsState === "loading" && ttsChapterId === activeDocumentId;

  const handleReadAloud = useCallback(() => {
    if (!editor || !activeDocumentId || !chapter) return;
    const text = extractReadAloudText(editor);
    if (!text.trim()) return;
    void startReadAloud({
      chapterId: activeDocumentId,
      chapterTitle: chapter.title || "Untitled chapter",
      text,
      apiKey: ttsApiKey,
      provider: "openrouter",
      model: ttsModel,
      voice: ttsVoice,
    });
  }, [
    editor,
    activeDocumentId,
    chapter,
    ttsApiKey,
    ttsModel,
    ttsVoice,
    startReadAloud,
  ]);

  const toggleGrammar = useCallback(() => {
    void updateAppSettings({ grammarCheckerEnabled: !grammarEnabled });
  }, [grammarEnabled]);

  // Open grammar scanner with current grammar issues
  const handleOpenGrammarScanner = useCallback(() => {
    if (!editor) return;
    openGrammarScanner(getGrammarResults(editor.state));
    openModal({ id: "grammar-scanner" });
  }, [editor, openGrammarScanner, openModal]);

  // Link editor callbacks
  const handleLinkApply = useCallback(
    (href: string) => {
      if (editor) {
        editor.chain().focus().setLink({ href }).run();
      }
    },
    [editor],
  );
  const handleLinkRemove = useCallback(() => {
    if (editor) {
      editor.chain().focus().unsetLink().run();
    }
  }, [editor]);

  // Image insert callback
  const handleImageInsert = useCallback(
    (src: string, alt: string) => {
      if (editor) {
        editor.chain().focus().setImage({ src, alt }).run();
      }
    },
    [editor],
  );

  // Ruby text callback
  const handleRubyApply = useCallback(
    (annotation: string) => {
      if (editor) {
        editor.chain().focus().setRuby({ annotation }).run();
      }
    },
    [editor],
  );
  const handleRubyRemove = useCallback(() => {
    if (editor) {
      editor.chain().focus().unsetRuby().run();
    }
  }, [editor]);

  // Handle modal button clicks
  const handleModalOpen = useCallback(
    (modal: ToolbarActionModal) => {
      if (!editor) return;
      if (modal === "link-editor") {
        const attrs = editor.getAttributes("link");
        openModal({ id: "link-editor", currentHref: attrs.href });
      } else if (modal === "insert-image") {
        openModal({ id: "insert-image" });
      } else if (modal === "ruby-editor") {
        const attrs = editor.getAttributes("ruby");
        openModal({ id: "ruby-editor", currentAnnotation: attrs.annotation });
      }
    },
    [editor, openModal],
  );

  const editorState = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e)
        return { activeStates: {}, hasSelection: false, selectedHtml: "" };
      const result: Record<string, boolean> = {};
      for (const action of actions) {
        if (action.isActive) {
          result[action.label] = action.isActive(e);
        }
      }
      const { from, to, empty } = e.state.selection;
      let selectedHtml = "";
      if (!empty) {
        const slice = e.state.doc.slice(from, to);
        const json = { type: "doc", content: slice.content.toJSON() };
        selectedHtml = generateHTML(json, e.extensionManager.extensions);
      }
      return {
        activeStates: result,
        hasSelection: !empty && selectedHtml.trim().length > 0,
        selectedHtml,
      };
    },
  });

  const activeStates = editorState?.activeStates ?? {};
  const hasSelection = editorState?.hasSelection ?? false;
  const selectedHtml = editorState?.selectedHtml ?? "";

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-density border-b border-neutral-200 bg-white px-4 py-density-button dark:border-neutral-800 dark:bg-neutral-900">
      <FontSelector currentFont={currentFont} />
      <FontSizeSelector currentFontSize={settings?.editorFontSize ?? 16} />
      <ToolbarSeparator />
      {groups.map((group, gi) => {
        const groupActions = actions.filter((a) => a.group === group);
        if (groupActions.length === 0) return null;

        // Render alignment group as a dropdown
        if (group === "align") {
          return (
            <div key={group} className="flex items-center">
              {gi > 0 && <ToolbarSeparator />}
              <AlignmentDropdown editor={editor} />
            </div>
          );
        }

        return (
          <div key={group} className="flex items-center">
            {gi > 0 && <ToolbarSeparator />}
            {groupActions.map((action) => (
              <ToolbarButton
                key={action.label}
                icon={action.icon}
                title={action.label}
                variant={
                  (activeStates[action.label] ?? false) ? "active" : "default"
                }
                onClick={() =>
                  action.kind === "modal"
                    ? handleModalOpen(action.modal)
                    : action.run(editor)
                }
              />
            ))}
          </div>
        );
      })}
      <ToolbarSeparator />
      <ToolbarButton
        icon={Brackets}
        title="Insert hole (Ctrl+Shift+H)"
        onClick={() => editor.chain().focus().insertHole().run()}
      />
      <SharedChapterActions
        editor={editor}
        projectId={activeProjectId}
        chapterId={activeDocumentId}
        onToggleFocusMode={toggleFocusMode}
        beforeCopy={<ShareSessionButton />}
        afterCopy={
          <>
            <TextToolsMenu editor={editor} />
            {canReadAloud && (
              <ToolbarButton
                icon={Volume2}
                title={
                  hasSelection ? "Read selection aloud" : "Read chapter aloud"
                }
                onClick={handleReadAloud}
                disabled={readAloudLoading}
              />
            )}
            <ToolbarButton
              icon={ImagePlus}
              title="Preview Card (Ctrl+Shift+P)"
              onClick={() =>
                openModal({
                  id: "preview-card",
                  selectedHtml,
                  projectTitle: activeProjectTitle ?? "Untitled",
                  chapterTitle: chapter?.title ?? "",
                })
              }
              disabled={!hasSelection}
            />
          </>
        }
        afterSpellcheck={
          <>
            <ToolbarButton
              icon={SpellCheck2}
              title="Toggle grammar checker"
              onClick={toggleGrammar}
              variant={grammarEnabled ? "active" : "default"}
            />
            <ToolbarButton
              icon={TextSearch}
              title="Open grammar scanner"
              onClick={handleOpenGrammarScanner}
              disabled={!grammarEnabled}
            />
          </>
        }
      />
      <LinkEditorDialog onApply={handleLinkApply} onRemove={handleLinkRemove} />
      <InsertImageDialog onInsert={handleImageInsert} />
      <RubyDialog onApply={handleRubyApply} onRemove={handleRubyRemove} />
    </div>
  );
}
