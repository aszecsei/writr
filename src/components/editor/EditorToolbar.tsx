"use client";

import { type Editor, useEditorState } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import {
  Bold,
  Code,
  Download,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { updateAppSettings } from "@/db/operations";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useChapter } from "@/hooks/useChapter";
import { EDITOR_FONTS, type EditorFont } from "@/lib/fonts";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";

interface EditorToolbarProps {
  editor: Editor | null;
}

interface ToolbarAction {
  label: string;
  icon: LucideIcon;
  action: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
  group: "text" | "heading" | "block" | "history";
}

const actions: ToolbarAction[] = [
  {
    label: "Bold",
    icon: Bold,
    action: (e) => e.chain().focus().toggleBold().run(),
    isActive: (e) => e.isActive("bold"),
    group: "text",
  },
  {
    label: "Italic",
    icon: Italic,
    action: (e) => e.chain().focus().toggleItalic().run(),
    isActive: (e) => e.isActive("italic"),
    group: "text",
  },
  {
    label: "Underline",
    icon: Underline,
    action: (e) => e.chain().focus().toggleUnderline().run(),
    isActive: (e) => e.isActive("underline"),
    group: "text",
  },
  {
    label: "Strikethrough",
    icon: Strikethrough,
    action: (e) => e.chain().focus().toggleStrike().run(),
    isActive: (e) => e.isActive("strike"),
    group: "text",
  },
  {
    label: "Heading 1",
    icon: Heading1,
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (e) => e.isActive("heading", { level: 1 }),
    group: "heading",
  },
  {
    label: "Heading 2",
    icon: Heading2,
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (e) => e.isActive("heading", { level: 2 }),
    group: "heading",
  },
  {
    label: "Heading 3",
    icon: Heading3,
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (e) => e.isActive("heading", { level: 3 }),
    group: "heading",
  },
  {
    label: "Blockquote",
    icon: Quote,
    action: (e) => e.chain().focus().toggleBlockquote().run(),
    isActive: (e) => e.isActive("blockquote"),
    group: "block",
  },
  {
    label: "Bullet List",
    icon: List,
    action: (e) => e.chain().focus().toggleBulletList().run(),
    isActive: (e) => e.isActive("bulletList"),
    group: "block",
  },
  {
    label: "Ordered List",
    icon: ListOrdered,
    action: (e) => e.chain().focus().toggleOrderedList().run(),
    isActive: (e) => e.isActive("orderedList"),
    group: "block",
  },
  {
    label: "Code Block",
    icon: Code,
    action: (e) => e.chain().focus().toggleCodeBlock().run(),
    isActive: (e) => e.isActive("codeBlock"),
    group: "block",
  },
  {
    label: "Undo",
    icon: Undo2,
    action: (e) => e.chain().focus().undo().run(),
    group: "history",
  },
  {
    label: "Redo",
    icon: Redo2,
    action: (e) => e.chain().focus().redo().run(),
    group: "history",
  },
];

const CATEGORY_LABELS: Record<EditorFont["category"], string> = {
  serif: "Serif",
  sans: "Sans-Serif",
  accessible: "Accessible",
};

const groups: ToolbarAction["group"][] = [
  "text",
  "heading",
  "block",
  "history",
];

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const settings = useAppSettings();
  const currentFont = settings?.editorFont ?? "literata";
  const openModal = useUiStore((s) => s.openModal);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProjectTitle = useProjectStore((s) => s.activeProjectTitle);

  const chapter = useChapter(activeDocumentId);

  const editorState = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e)
        return { activeStates: {}, hasSelection: false, selectedText: "" };
      const result: Record<string, boolean> = {};
      for (const action of actions) {
        if (action.isActive) {
          result[action.label] = action.isActive(e);
        }
      }
      const { from, to, empty } = e.state.selection;
      const text = empty ? "" : e.state.doc.textBetween(from, to, " ");
      return {
        activeStates: result,
        hasSelection: !empty && text.trim().length > 0,
        selectedText: text,
      };
    },
  });

  const activeStates = editorState?.activeStates ?? {};
  const hasSelection = editorState?.hasSelection ?? false;
  const selectedText = editorState?.selectedText ?? "";

  async function handleFontChange(e: React.ChangeEvent<HTMLSelectElement>) {
    await updateAppSettings({ editorFont: e.target.value });
  }

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <label className="flex items-center gap-1">
        <span className="sr-only">Editor font</span>
        <select
          value={currentFont}
          onChange={handleFontChange}
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {(["serif", "sans", "accessible"] as const).map((cat) => (
            <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
              {EDITOR_FONTS.filter((f) => f.category === cat).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
      {groups.map((group, gi) => {
        const groupActions = actions.filter((a) => a.group === group);
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
                  onClick={() => action.action(editor)}
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
          <button
            type="button"
            title="Preview Card (Ctrl+Shift+P)"
            onClick={() =>
              openModal({
                id: "preview-card",
                selectedText,
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
    </div>
  );
}
