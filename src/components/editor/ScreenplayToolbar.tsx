"use client";

import { type Editor, useEditorState } from "@tiptap/react";
import { Brackets } from "lucide-react";
import { ToolbarButton } from "@/components/ui/ToolbarButton";
import { ToolbarSeparator } from "@/components/ui/ToolbarSeparator";
import { selectActiveChapterId, useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";
import { SharedChapterActions } from "./EditorToolbar";
import { actions, screenplayElementActions } from "./toolbar-actions";

/** Tooltip text for the shared history actions, matching their keyboard shortcuts. */
const HISTORY_TITLES: Record<string, string> = {
  Undo: "Undo (Ctrl+Z)",
  Redo: "Redo (Ctrl+Y)",
};

const historyActions = actions.filter((a) => a.group === "history");

interface ScreenplayToolbarProps {
  editor: Editor | null;
}

export function ScreenplayToolbar({ editor }: ScreenplayToolbarProps) {
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const activeDocumentId = useEditorStore(selectActiveChapterId);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const editorState = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { activeLabel: null };
      const activeAction = screenplayElementActions.find((a) =>
        a.isActive?.(e),
      );
      return { activeLabel: activeAction?.label ?? null };
    },
  });

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-density border-b border-neutral-200 bg-white px-4 py-density-button dark:border-neutral-800 dark:bg-neutral-900">
      {/* Element type buttons */}
      {screenplayElementActions.map((action) => {
        const isActive = editorState?.activeLabel === action.label;
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            title={action.label}
            onClick={() => action.action(editor)}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              isActive
                ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            <Icon size={14} />
            {action.label}
          </button>
        );
      })}

      <ToolbarSeparator />
      {historyActions.map((action) => (
        <ToolbarButton
          key={action.label}
          icon={action.icon}
          title={HISTORY_TITLES[action.label] ?? action.label}
          onClick={() => action.action(editor)}
        />
      ))}

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
      />
    </div>
  );
}
