"use client";

import { type Editor, useEditorState } from "@tiptap/react";
import {
  Download,
  History,
  Maximize2,
  PanelRight,
  ScanSearch,
  SpellCheck,
} from "lucide-react";
import { useCallback } from "react";
import { useCommentStore } from "@/store/commentStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useSpellcheckStore } from "@/store/spellcheckStore";
import { useUiStore } from "@/store/uiStore";
import { CopyMenu } from "./CopyMenu";
import { CreateCommentButton } from "./comments";
import { getSpellcheckResults } from "./extensions/Spellcheck";

const ELEMENT_TYPES = [
  { name: "sceneHeading", label: "Scene" },
  { name: "action", label: "Action" },
  { name: "character", label: "Character" },
  { name: "dialogue", label: "Dialogue" },
  { name: "parenthetical", label: "Paren" },
  { name: "transition", label: "Transition" },
  { name: "centered", label: "Centered" },
] as const;

interface ScreenplayToolbarProps {
  editor: Editor | null;
}

export function ScreenplayToolbar({ editor }: ScreenplayToolbarProps) {
  const openModal = useUiStore((s) => s.openModal);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const marginVisible = useCommentStore((s) => s.marginVisible);
  const toggleMargin = useCommentStore((s) => s.toggleMargin);
  const spellcheckEnabled = useSpellcheckStore((s) => s.enabled);
  const toggleSpellcheck = useSpellcheckStore((s) => s.toggleEnabled);
  const openScanner = useSpellcheckStore((s) => s.openScanner);

  const handleOpenScanner = useCallback(() => {
    if (!editor) return;
    const results = getSpellcheckResults(editor.state);
    openScanner(results);
  }, [editor, openScanner]);

  const editorState = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { activeType: null };
      for (const el of ELEMENT_TYPES) {
        if (e.isActive(el.name)) return { activeType: el.name };
      }
      return { activeType: null };
    },
  });

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-density border-b border-neutral-200 bg-white px-4 py-density-button dark:border-neutral-800 dark:bg-neutral-900">
      {/* Element type buttons */}
      {ELEMENT_TYPES.map((el) => {
        const isActive = editorState?.activeType === el.name;
        return (
          <button
            key={el.name}
            type="button"
            title={el.label}
            onClick={() => {
              editor.chain().focus().setNode(el.name).run();
            }}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              isActive
                ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            {el.label}
          </button>
        );
      })}

      {activeProjectId && activeDocumentId && (
        <>
          <div className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
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
            className="rounded p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            title="Version history"
            onClick={() =>
              openModal({
                id: "version-history",
                chapterId: activeDocumentId,
                projectId: activeProjectId,
              })
            }
            className="rounded p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            <History size={16} />
          </button>
          <CopyMenu projectId={activeProjectId} chapterId={activeDocumentId} />
          <div className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
          <CreateCommentButton
            editor={editor}
            projectId={activeProjectId}
            chapterId={activeDocumentId}
          />
          <button
            type="button"
            title="Toggle comment margin"
            onClick={toggleMargin}
            className={`rounded p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              marginVisible
                ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            <PanelRight size={16} />
          </button>
          <div className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
          <button
            type="button"
            title="Toggle spellcheck"
            onClick={toggleSpellcheck}
            className={`rounded p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              spellcheckEnabled
                ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            <SpellCheck size={16} />
          </button>
          <button
            type="button"
            title="Open spellcheck scanner"
            onClick={handleOpenScanner}
            disabled={!spellcheckEnabled}
            className={`rounded p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              spellcheckEnabled
                ? "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                : "cursor-not-allowed text-neutral-300 dark:text-neutral-600"
            }`}
          >
            <ScanSearch size={16} />
          </button>
        </>
      )}
      <div className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
      <button
        type="button"
        title="Focus mode (Ctrl+Shift+F)"
        onClick={toggleFocusMode}
        className="rounded p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        <Maximize2 size={16} />
      </button>
    </div>
  );
}
