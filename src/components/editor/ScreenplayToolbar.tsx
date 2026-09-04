"use client";

import { type Editor, useEditorState } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import {
  AlignCenter,
  ArrowRight,
  Brackets,
  Clapperboard,
  Download,
  History,
  Maximize2,
  MessageSquare,
  PanelRight,
  Parentheses,
  Redo2,
  ScanSearch,
  SpellCheck,
  Undo2,
  User,
  Zap,
} from "lucide-react";
import { useCallback } from "react";
import { ToolbarButton } from "@/components/ui/ToolbarButton";
import { ToolbarSeparator } from "@/components/ui/ToolbarSeparator";
import { useCommentStore } from "@/store/commentStore";
import { selectActiveChapterId, useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useSpellcheckStore } from "@/store/spellcheckStore";
import { useUiStore } from "@/store/uiStore";
import { CopyMenu } from "./CopyMenu";
import { CreateCommentButton } from "./comments";
import { getSpellcheckResults } from "./extensions/Spellcheck";

const ELEMENT_TYPES: readonly {
  name: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { name: "sceneHeading", label: "Scene", icon: Clapperboard },
  { name: "action", label: "Action", icon: Zap },
  { name: "character", label: "Character", icon: User },
  { name: "dialogue", label: "Dialogue", icon: MessageSquare },
  { name: "parenthetical", label: "Paren", icon: Parentheses },
  { name: "transition", label: "Transition", icon: ArrowRight },
  { name: "centered", label: "Centered", icon: AlignCenter },
];

interface ScreenplayToolbarProps {
  editor: Editor | null;
}

export function ScreenplayToolbar({ editor }: ScreenplayToolbarProps) {
  const openModal = useUiStore((s) => s.openModal);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const activeDocumentId = useEditorStore(selectActiveChapterId);
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
    openModal({ id: "spellcheck-scanner" });
  }, [editor, openScanner, openModal]);

  const editorState = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { activeType: null, canUndo: false, canRedo: false };
      let activeType: string | null = null;
      for (const el of ELEMENT_TYPES) {
        if (e.isActive(el.name)) {
          activeType = el.name;
          break;
        }
      }
      return {
        activeType,
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-density border-b border-neutral-200 bg-white px-4 py-density-button dark:border-neutral-800 dark:bg-neutral-900">
      {/* Element type buttons */}
      {ELEMENT_TYPES.map((el) => {
        const isActive = editorState?.activeType === el.name;
        const Icon = el.icon;
        return (
          <button
            key={el.name}
            type="button"
            title={el.label}
            onClick={() => {
              editor.chain().focus().setNode(el.name).run();
            }}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              isActive
                ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            <Icon size={14} />
            {el.label}
          </button>
        );
      })}

      <ToolbarSeparator />
      <ToolbarButton
        icon={Undo2}
        title="Undo (Ctrl+Z)"
        disabled={!editorState?.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        icon={Redo2}
        title="Redo (Ctrl+Y)"
        disabled={!editorState?.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      />

      <ToolbarSeparator />
      <ToolbarButton
        icon={Brackets}
        title="Insert hole (Ctrl+Shift+H)"
        onClick={() => editor.chain().focus().insertHole().run()}
      />

      {activeProjectId && activeDocumentId && (
        <>
          <ToolbarSeparator />
          <ToolbarButton
            icon={Download}
            title="Export"
            onClick={() =>
              openModal({
                id: "export",
                projectId: activeProjectId,
                chapterId: activeDocumentId,
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
                chapterId: activeDocumentId,
                projectId: activeProjectId,
              })
            }
          />
          <CopyMenu projectId={activeProjectId} chapterId={activeDocumentId} />
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
        </>
      )}
      <ToolbarSeparator />
      <ToolbarButton
        icon={Maximize2}
        title="Focus mode (Ctrl+Shift+F)"
        onClick={toggleFocusMode}
      />
    </div>
  );
}
