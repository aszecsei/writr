"use client";

import { generateHTML } from "@tiptap/core";
import { type Editor, useEditorState } from "@tiptap/react";
import { Download, ImagePlus, Maximize2, PanelRight } from "lucide-react";
import { useCallback } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useChapter } from "@/hooks/useChapter";
import { useCommentStore } from "@/store/commentStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";
import { AlignmentDropdown } from "./AlignmentDropdown";
import { CopyMenu } from "./CopyMenu";
import { CreateCommentButton } from "./comments";
import { FontSelector } from "./FontSelector";
import { InsertImageDialog } from "./InsertImageDialog";
import { LinkEditorDialog } from "./LinkEditorDialog";
import { RubyDialog } from "./RubyDialog";
import { actions, groups } from "./toolbar-actions";

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const settings = useAppSettings();
  const currentFont = settings?.editorFont ?? "literata";
  const openModal = useUiStore((s) => s.openModal);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProjectTitle = useProjectStore((s) => s.activeProjectTitle);
  const marginVisible = useCommentStore((s) => s.marginVisible);
  const toggleMargin = useCommentStore((s) => s.toggleMargin);

  const chapter = useChapter(activeDocumentId);

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
  const handleModalAction = useCallback(
    (label: string) => {
      if (!editor) return;
      if (label === "Link") {
        const attrs = editor.getAttributes("link");
        openModal({ id: "link-editor", currentHref: attrs.href });
      } else if (label === "Image") {
        openModal({ id: "insert-image" });
      } else if (label === "Ruby Text") {
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
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <FontSelector currentFont={currentFont} />
      <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
      {groups.map((group, gi) => {
        const groupActions = actions.filter((a) => a.group === group);
        if (groupActions.length === 0) return null;

        // Render alignment group as a dropdown
        if (group === "align") {
          return (
            <div key={group} className="flex items-center">
              {gi > 0 && (
                <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
              )}
              <AlignmentDropdown editor={editor} />
            </div>
          );
        }

        return (
          <div key={group} className="flex items-center">
            {gi > 0 && (
              <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
            )}
            {groupActions.map((action) => {
              const active = activeStates[action.label] ?? false;
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  title={action.label}
                  onClick={() =>
                    action.opensModal
                      ? handleModalAction(action.label)
                      : action.action(editor)
                  }
                  className={`rounded p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                    active
                      ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        );
      })}
      {activeProjectId && activeDocumentId && (
        <>
          <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <button
            type="button"
            title="Export"
            onClick={() =>
              openModal({
                id: "export",
                projectId: activeProjectId,
                chapterId: activeDocumentId,
                scope: "chapter",
              })
            }
            className="rounded p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <Download size={16} />
          </button>
          <CopyMenu projectId={activeProjectId} chapterId={activeDocumentId} />
          <button
            type="button"
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
            className={`rounded p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              hasSelection
                ? "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                : "cursor-not-allowed text-zinc-300 dark:text-zinc-600"
            }`}
          >
            <ImagePlus size={16} />
          </button>
          <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <CreateCommentButton
            editor={editor}
            projectId={activeProjectId}
            chapterId={activeDocumentId}
          />
          <button
            type="button"
            title="Toggle comment margin"
            onClick={toggleMargin}
            className={`rounded p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              marginVisible
                ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <PanelRight size={16} />
          </button>
        </>
      )}
      <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
      <button
        type="button"
        title="Focus mode (Ctrl+Shift+F)"
        onClick={toggleFocusMode}
        className="rounded p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Maximize2 size={16} />
      </button>
      <LinkEditorDialog onApply={handleLinkApply} onRemove={handleLinkRemove} />
      <InsertImageDialog onInsert={handleImageInsert} />
      <RubyDialog onApply={handleRubyApply} onRemove={handleRubyRemove} />
    </div>
  );
}
